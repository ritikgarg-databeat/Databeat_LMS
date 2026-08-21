import type { Prisma } from '@prisma/client';

import { activeGroupMembershipWhere, activeGroupScope } from '@/policies/group-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { CalendarEventListFilters } from './calendar.types';

const assignmentsInclude = {
  assignments: {
    include: {
      department: { select: { id: true, name: true } },
      group: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.CalendarEventInclude;

export type CalendarEventWithAssignments = Prisma.CalendarEventGetPayload<{
  include: typeof assignmentsInclude;
}>;

const mineSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  startAt: true,
  endAt: true,
  allDay: true,
  location: true,
} satisfies Prisma.CalendarEventSelect;

// This is a calendar-grid view, not a paginated management list — when neither `from` nor `to`
// is given we still cap the result set at a reasonable size rather than returning every event
// ever created (Prompt 6 § GET /calendar/events).
const MAX_UNBOUNDED_EVENTS = 500;

function buildStartAtFilter(filters: CalendarEventListFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.from && !filters.to) return undefined;
  return {
    ...(filters.from ? { gte: new Date(filters.from) } : {}),
    ...(filters.to ? { lte: new Date(filters.to) } : {}),
  };
}

// Data-access layer for the calendar module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class CalendarRepository extends BaseRepository {
  findMany(filters: CalendarEventListFilters, trainerId?: string) {
    const startAt = buildStartAtFilter(filters);
    const hasRange = Boolean(filters.from || filters.to);

    const where: Prisma.CalendarEventWhereInput = {
      deletedAt: null,
      ...(startAt ? { startAt } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(trainerId
        ? {
            OR: [
              { createdById: trainerId },
              { assignments: { some: { group: { trainerId, deletedAt: null } } } },
              {
                assignments: {
                  some: {
                    department: {
                      OR: [
                        { users: { some: { id: trainerId } } },
                        { groups: { some: { trainerId, deletedAt: null } } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    return this.db.calendarEvent.findMany({
      where,
      include: assignmentsInclude,
      // No explicit range: most-recent-first, capped. A range was given: chronological order
      // within that window (Prompt 6 § GET /calendar/events).
      orderBy: { startAt: hasRange ? 'asc' : 'desc' },
      ...(hasRange ? {} : { take: MAX_UNBOUNDED_EVENTS }),
    });
  }

  async isOwnedBy(eventId: string, userId: string): Promise<boolean> {
    return (
      (await this.db.calendarEvent.findFirst({
        where: { id: eventId, createdById: userId, deletedAt: null },
        select: { id: true },
      })) !== null
    );
  }

  async isInTrainerViewScope(eventId: string, trainerId: string): Promise<boolean> {
    return (
      (await this.db.calendarEvent.findFirst({
        where: {
          id: eventId,
          deletedAt: null,
          OR: [
            { createdById: trainerId },
            { assignments: { some: { group: { trainerId, deletedAt: null } } } },
            {
              assignments: {
                some: {
                  department: {
                    OR: [
                      { users: { some: { id: trainerId } } },
                      { groups: { some: { trainerId, deletedAt: null } } },
                    ],
                  },
                },
              },
            },
          ],
        },
        select: { id: true },
      })) !== null
    );
  }

  findById(id: string) {
    return this.db.calendarEvent.findFirst({ where: { id, deletedAt: null }, include: assignmentsInclude });
  }

  /** Creates the event plus one CalendarEventAssignment row per department/group id, atomically. */
  async createWithAssignments(
    data: Prisma.CalendarEventCreateInput,
    departmentIds: string[],
    groupIds: string[],
  ): Promise<CalendarEventWithAssignments> {
    return this.db.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({ data });

      if (departmentIds.length > 0 || groupIds.length > 0) {
        await tx.calendarEventAssignment.createMany({
          data: [
            ...departmentIds.map((departmentId) => ({ eventId: event.id, departmentId })),
            ...groupIds.map((groupId) => ({ eventId: event.id, groupId })),
          ],
        });
      }

      return tx.calendarEvent.findUniqueOrThrow({ where: { id: event.id }, include: assignmentsInclude });
    });
  }

  /**
   * Updates event fields and, only when `assignments` is provided, REPLACES the full assignment
   * set (delete-then-recreate) inside the same transaction (Prompt 6 § PATCH /calendar/events/:id
   * — omitting the `assignments` argument entirely must leave existing rows untouched).
   */
  async updateWithAssignments(
    id: string,
    data: Prisma.CalendarEventUpdateInput,
    assignments?: { departmentIds: string[]; groupIds: string[] },
  ): Promise<CalendarEventWithAssignments> {
    return this.db.$transaction(async (tx) => {
      await tx.calendarEvent.update({ where: { id }, data });

      if (assignments) {
        await tx.calendarEventAssignment.deleteMany({ where: { eventId: id } });

        if (assignments.departmentIds.length > 0 || assignments.groupIds.length > 0) {
          await tx.calendarEventAssignment.createMany({
            data: [
              ...assignments.departmentIds.map((departmentId) => ({ eventId: id, departmentId })),
              ...assignments.groupIds.map((groupId) => ({ eventId: id, groupId })),
            ],
          });
        }
      }

      return tx.calendarEvent.findUniqueOrThrow({ where: { id }, include: assignmentsInclude });
    });
  }

  softDelete(id: string) {
    return this.db.calendarEvent.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Every user in any of `departmentIds`, plus every GroupMember of any of `groupIds` — de-duplicated. */
  async findAssignedUserIds(departmentIds: string[], groupIds: string[]): Promise<string[]> {
    const [departmentUsers, groupMembers] = await Promise.all([
      departmentIds.length > 0
        ? this.db.user.findMany({
            where: { departmentId: { in: departmentIds }, isActive: true },
            select: { id: true },
          })
        : Promise.resolve([]),
      groupIds.length > 0
        ? this.db.groupMember.findMany({
            where: {
              groupId: { in: groupIds },
              group: activeGroupScope(),
              user: { isActive: true },
            },
            select: { userId: true },
          })
        : Promise.resolve([]),
    ]);

    const userIds = new Set<string>();
    departmentUsers.forEach((user) => userIds.add(user.id));
    groupMembers.forEach((member) => userIds.add(member.userId));
    return Array.from(userIds);
  }

  /** Distinct groupIds `userId` belongs to — used to resolve `/calendar/events/mine` and access checks. */
  async findUserGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.db.groupMember.findMany({
      where: activeGroupMembershipWhere(userId),
      select: { groupId: true },
    });
    return memberships.map((membership) => membership.groupId);
  }

  /**
   * Events assigned to a user via their department OR any of their groups (Prompt 6 §
   * GET /calendar/events/mine), de-duplicated (an event assigned via both a matching department
   * AND a matching group must still be returned once — `some` on the join already guarantees
   * this since it matches the parent CalendarEvent row, not the individual assignment rows).
   */
  findMine(userId: string, filters: CalendarEventListFilters) {
    const startAt = buildStartAtFilter(filters);

    return this.db.calendarEvent.findMany({
      where: {
        deletedAt: null,
        ...(startAt ? { startAt } : {}),
        assignments: {
          some: {
            OR: [
              { userId },
              { department: { users: { some: { id: userId } } } },
              { group: activeGroupScope({ members: { some: { userId } } }) },
            ],
          },
        },
      },
      select: mineSelect,
      orderBy: { startAt: 'asc' },
    });
  }
}
