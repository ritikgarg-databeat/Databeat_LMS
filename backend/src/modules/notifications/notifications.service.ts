import type { Role } from '@prisma/client';

import { GroupsRepository } from '@/modules/groups/groups.repository';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { ForbiddenError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { CreateAnnouncementDto, NotifyInput } from './notifications.dto';
import { NotificationsRepository } from './notifications.repository';
import type { NotificationListFilters } from './notifications.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the notifications module. Controllers call into this layer only — except
// `notify`/`notifyMany`, which every other module is expected to import and call directly
// (mirroring `auditLogService.record()`'s role, see ARCHITECTURE.md §3.1).
export class NotificationsService extends BaseService {
  constructor(
    protected readonly repository: NotificationsRepository = new NotificationsRepository(),
    // Imported directly (not via `@/modules/groups`'s index) — mirrors how assessments.service.ts
    // and courses.service.ts already depend on `GroupsRepository` for group-scoped operations.
    private readonly groupsRepository: GroupsRepository = new GroupsRepository(),
  ) {
    super();
  }

  async list(
    userId: string,
    filters: NotificationListFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(userId, filters, (page - 1) * pageSize, pageSize);
    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  unreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markRead(id: string, userId: string) {
    const notification = await this.repository.findById(id);
    if (!notification) throw new NotFoundError('Notification not found.');
    if (notification.userId !== userId) {
      throw new ForbiddenError("You don't have permission to modify this notification.");
    }
    return this.repository.markRead(id);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repository.markAllRead(userId);
  }

  /** Owner-only hard delete of a single notification — 404 if missing, 403 if it isn't yours (mirrors `markRead`). */
  async deleteOne(id: string, userId: string): Promise<void> {
    const notification = await this.repository.findById(id);
    if (!notification) throw new NotFoundError('Notification not found.');
    if (notification.userId !== userId) {
      throw new ForbiddenError("You don't have permission to delete this notification.");
    }
    await this.repository.delete(id);
  }

  /**
   * The one cross-module entry point into this service — see class doc comment. This is the
   * single choke point every other module's notification call flows through, so it's the only
   * place that needs to check `NotificationPreference.mutedTypes` (Prompt 9 § NOTIFICATION
   * SYSTEM) — a muted type is skipped silently: no row created, no error.
   */
  async notify(input: NotifyInput): Promise<void> {
    const mutedTypes = await this.repository.findMutedTypes(input.userId);
    if (mutedTypes.includes(input.type)) return;

    await this.repository.create({
      user: { connect: { id: input.userId } },
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    });
  }

  /**
   * Bulk convenience for "notify every member of a group" (assessment/course assignment,
   * trainer announcements, etc). Mute-checks every target user in a single batched query
   * (`findMutedTypesByUserIds`) rather than one `notify()` call per user, then silently drops
   * anyone who has `input.type` muted before writing any rows. Returns the post-mute count of
   * rows actually created, so callers that report a "notified N users" figure (e.g.
   * `createAnnouncement`) don't overstate delivery to users who muted that type.
   */
  async notifyMany(userIds: string[], input: Omit<NotifyInput, 'userId'>): Promise<number> {
    if (userIds.length === 0) return 0;

    const mutedByUser = await this.repository.findMutedTypesByUserIds(userIds);
    const targetUserIds = userIds.filter((userId) => !(mutedByUser.get(userId) ?? []).includes(input.type));

    await this.repository.createMany(
      targetUserIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      })),
    );

    return targetUserIds.length;
  }

  /**
   * TRAINER/SUPER_ADMIN broadcast to every TRAINEE member of a group (Prompt 9 § NOTIFICATION
   * SYSTEM). A TRAINER may only target a group they're assigned to (`Group.trainerId`), mirroring
   * the Prompt 8 analytics module's trainer-scoping idiom (see analytics.service.ts's
   * `getGroupAnalytics`) — SUPER_ADMIN may target any existing group.
   */
  async createAnnouncement(dto: CreateAnnouncementDto, actor: Actor): Promise<{ notifiedCount: number }> {
    const group = await this.groupsRepository.findById(dto.groupId);
    if (!group) throw new NotFoundError('Group not found.');
    if (actor.role !== 'SUPER_ADMIN' && group.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to send announcements to this group.");
    }

    const memberUserIds = await this.repository.findGroupTraineeUserIds(dto.groupId);
    const notifiedCount = await this.notifyMany(memberUserIds, {
      type: 'TRAINER_ANNOUNCEMENT',
      title: dto.title || 'Announcement from your trainer',
      message: dto.message,
      relatedEntityType: 'group',
      relatedEntityId: dto.groupId,
    });

    return { notifiedCount };
  }

  /**
   * Proactive, org-wide counterpart to `checkAndCreateDeadlineReminders` — called once a day by
   * `jobs/deadline-reminders.job.ts` (node-cron, see `jobs/scheduler.ts`) rather than waiting for
   * each trainee to happen to open their own notification list. For every assessment due within
   * the reminder window, resolves candidate trainee userIds (every assigned group's members minus
   * anyone who already submitted — both already computed by `findAssessmentsWithUpcomingDeadlines`
   * in one query), subtracts anyone already notified for that assessment (one batched query per
   * assessment via `findAlreadyNotifiedUserIds`), then fans out through `notifyMany` — which
   * already handles mute-checking — rather than looping `notify()` once per user.
   */
  async runScheduledDeadlineReminders(): Promise<{ assessmentsChecked: number; notificationsSent: number }> {
    const assessments = await this.repository.findAssessmentsWithUpcomingDeadlines();
    let notificationsSent = 0;

    for (const assessment of assessments) {
      const submittedUserIds = new Set(assessment.attempts.map((attempt) => attempt.userId));
      const candidateUserIds = new Set(
        assessment.groupAssignments.flatMap((assignment) =>
          assignment.group.members.map((member) => member.userId),
        ),
      );
      const notYetSubmitted = [...candidateUserIds].filter((userId) => !submittedUserIds.has(userId));
      if (notYetSubmitted.length === 0) continue;

      const alreadyNotified = await this.repository.findAlreadyNotifiedUserIds(
        notYetSubmitted,
        'ASSESSMENT_DEADLINE_APPROACHING',
        'assessment',
        assessment.id,
      );
      const toNotify = notYetSubmitted.filter((userId) => !alreadyNotified.has(userId));
      if (toNotify.length === 0) continue;

      notificationsSent += await this.notifyMany(toNotify, {
        type: 'ASSESSMENT_DEADLINE_APPROACHING',
        title: 'Assessment deadline approaching',
        message: `"${assessment.title}" is due ${assessment.dueDate ? assessment.dueDate.toLocaleDateString() : 'soon'}.`,
        relatedEntityType: 'assessment',
        relatedEntityId: assessment.id,
      });
    }

    return { assessmentsChecked: assessments.length, notificationsSent };
  }
}

export const notificationsService = new NotificationsService();
