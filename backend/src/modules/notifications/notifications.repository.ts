import type { NotificationType, Prisma } from '@prisma/client';

import { ASSESSMENT_DEADLINE_REMINDER_WINDOW_HOURS } from '@/constants/assessment';
import { activeGroupScope } from '@/policies/group-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { NotificationListFilters } from './notifications.types';

function buildWhere(userId: string, filters: NotificationListFilters): Prisma.NotificationWhereInput {
  const where: Prisma.NotificationWhereInput = { userId };
  if (filters.unreadOnly) where.isRead = false;
  return where;
}

// Data-access layer for the notifications module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class NotificationsRepository extends BaseRepository {
  async findMany(userId: string, filters: NotificationListFilters, skip: number, take: number) {
    const where = buildWhere(userId, filters);
    const [items, total] = await Promise.all([
      this.db.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.db.notification.count({ where }),
    ]);
    return { items, total };
  }

  countUnread(userId: string) {
    return this.db.notification.count({ where: { userId, isRead: false } });
  }

  findById(id: string) {
    return this.db.notification.findUnique({ where: { id } });
  }

  create(data: Prisma.NotificationCreateInput) {
    return this.db.notification.create({ data });
  }

  createMany(data: Prisma.NotificationCreateManyInput[]) {
    if (data.length === 0) return Promise.resolve({ count: 0 });
    return this.db.notification.createMany({ data });
  }

  markRead(id: string) {
    return this.db.notification.update({ where: { id }, data: { isRead: true } });
  }

  markAllRead(userId: string) {
    return this.db.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }

  delete(id: string) {
    return this.db.notification.delete({ where: { id } });
  }

  /**
   * Muted types for a single user (Prompt 9 § NOTIFICATION SYSTEM) — an absent
   * `NotificationPreference` row means "nothing muted", per schema.prisma's doc comment on
   * that model, so this returns `[]` rather than throwing/creating a row lazily.
   */
  async findMutedTypes(userId: string): Promise<NotificationType[]> {
    const preference = await this.db.notificationPreference.findUnique({
      where: { userId },
      select: { mutedTypes: true },
    });
    return preference?.mutedTypes ?? [];
  }

  /**
   * Batched version of `findMutedTypes` for `notifyMany` — one query covering every target user
   * instead of N, per Prompt 9's efficiency requirement. Users with no preference row simply
   * have no entry in the returned map (equivalent to "nothing muted").
   */
  async findMutedTypesByUserIds(userIds: string[]): Promise<Map<string, NotificationType[]>> {
    if (userIds.length === 0) return new Map();
    const preferences = await this.db.notificationPreference.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, mutedTypes: true },
    });
    return new Map(preferences.map((preference) => [preference.userId, preference.mutedTypes]));
  }

  /** TRAINEE userIds of every member of `groupId` — used to fan out TRAINER_ANNOUNCEMENT notifications. */
  async findGroupTraineeUserIds(groupId: string): Promise<string[]> {
    const members = await this.db.groupMember.findMany({
      where: { groupId, group: activeGroupScope(), user: { role: 'TRAINEE', isActive: true } },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  /** Idempotency check so the lazy deadline-reminder generator never creates a duplicate. */
  async hasNotificationForEntity(
    userId: string,
    type: NotificationType,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<boolean> {
    const existing = await this.db.notification.findFirst({
      where: { userId, type, relatedEntityType, relatedEntityId },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * Self-contained query (feature-local duplication, no cross-module import — see this
   * codebase's established convention from Prompt 5) backing the lazy deadline-reminder check:
   * assessments assigned to `userId` via group membership, published, not soft-deleted, due
   * within the reminder window, that this user has not yet submitted/had graded.
   */
  async findUpcomingUnsubmittedDeadlines(userId: string) {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + ASSESSMENT_DEADLINE_REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    return this.db.assessment.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        dueDate: { gte: now, lte: windowEnd },
        groupAssignments: {
          some: { group: activeGroupScope({ members: { some: { userId } } }) },
        },
        attempts: { none: { userId, status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'GRADED'] } } },
      },
      select: { id: true, title: true, dueDate: true },
    });
  }

  /**
   * Org-wide counterpart to `findUpcomingUnsubmittedDeadlines` — same window/status logic, but
   * with no `userId` filter, for the scheduled job (jobs/deadline-reminders.job.ts) to fan out to
   * every eligible trainee in one query instead of one query per user. Each assessment comes back
   * with every assigned group's member userIds AND every existing SUBMITTED/PENDING_REVIEW/GRADED
   * attempt's userId, so the caller can compute "candidate minus already-submitted" in memory
   * without a second round trip per assessment.
   */
  async findAssessmentsWithUpcomingDeadlines() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + ASSESSMENT_DEADLINE_REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    return this.db.assessment.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, dueDate: { gte: now, lte: windowEnd } },
      select: {
        id: true,
        title: true,
        dueDate: true,
        groupAssignments: {
          where: { group: activeGroupScope() },
          select: {
            group: {
              select: {
                members: {
                  where: { user: { role: 'TRAINEE', isActive: true } },
                  select: { userId: true },
                },
              },
            },
          },
        },
        attempts: {
          where: { status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'GRADED'] } },
          select: { userId: true },
        },
      },
    });
  }

  /** Batched version of `hasNotificationForEntity` — one query for every candidate user instead
   * of one query per user, for the same idempotency purpose (never double-send a reminder). */
  async findAlreadyNotifiedUserIds(
    userIds: string[],
    type: NotificationType,
    relatedEntityType: string,
    relatedEntityId: string,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const existing = await this.db.notification.findMany({
      where: { userId: { in: userIds }, type, relatedEntityType, relatedEntityId },
      select: { userId: true },
    });
    return new Set(existing.map((row) => row.userId));
  }

  /** Published mandatory courses with their active trainee audience and current lesson versions. */
  findMandatoryCoursesForReminders() {
    return this.db.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        groupAssignments: { some: { isMandatory: true, group: activeGroupScope() } },
      },
      select: {
        id: true,
        title: true,
        modules: {
          where: { isPublished: true },
          select: {
            lessons: {
              where: { isPublished: true },
              select: { id: true, contentVersion: true },
            },
          },
        },
        groupAssignments: {
          where: { isMandatory: true, group: activeGroupScope() },
          select: {
            group: {
              select: {
                members: {
                  where: { user: { role: 'TRAINEE', isActive: true } },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });
  }

  findMandatoryLessonProgress(userIds: string[], lessonIds: string[]) {
    if (userIds.length === 0 || lessonIds.length === 0) return Promise.resolve([]);
    return this.db.lessonProgress.findMany({
      where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
      select: { userId: true, lessonId: true, status: true, completedContentVersion: true },
    });
  }

  /** Weekly reminder dedupe without adding another notification enum/schema migration. */
  async findRecentlyRemindedUserIds(userIds: string[], courseId: string, since: Date): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.db.notification.findMany({
      where: {
        userId: { in: userIds },
        type: 'COURSE_ASSIGNED',
        title: 'Mandatory training reminder',
        relatedEntityType: 'course',
        relatedEntityId: courseId,
        createdAt: { gte: since },
      },
      select: { userId: true },
    });
    return new Set(rows.map((row) => row.userId));
  }
}
