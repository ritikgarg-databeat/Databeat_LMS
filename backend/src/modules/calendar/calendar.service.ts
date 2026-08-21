import type { Role } from '@prisma/client';

import { DepartmentsRepository } from '@/modules/departments/departments.repository';
import { GroupsRepository } from '@/modules/groups/groups.repository';
import { notificationsService } from '@/modules/notifications';
import { UsersRepository } from '@/modules/users/users.repository';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

import type { CreateCalendarEventDto, UpdateCalendarEventDto } from './calendar.dto';
import { CalendarRepository, type CalendarEventWithAssignments } from './calendar.repository';
import type { CalendarEventListFilters } from './calendar.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the calendar module. Controllers call into this layer only.
export class CalendarService extends BaseService {
  constructor(
    protected readonly repository: CalendarRepository = new CalendarRepository(),
    private readonly departmentsRepository: DepartmentsRepository = new DepartmentsRepository(),
    private readonly groupsRepository: GroupsRepository = new GroupsRepository(),
    private readonly usersRepository: UsersRepository = new UsersRepository(),
  ) {
    super();
  }

  async list(filters: CalendarEventListFilters, actor: Actor) {
    const events = await this.repository.findMany(filters, actor.role === 'TRAINER' ? actor.id : undefined);
    return events.map((event) => this.toListItem(event));
  }

  /**
   * Trainer/Super-Admin get the full detail view of any event. A Trainee is allowed through only
   * as a defense-in-depth fallback for an event that is actually assigned to them (same rule as
   * `listMine`) — `/calendar/events/mine` is their primary surface (Prompt 6 § GET /:id).
   */
  async getById(id: string, actor: Actor) {
    const event = await this.repository.findById(id);

    if (actor.role === 'TRAINEE') {
      if (!event) throw new ForbiddenError("You don't have permission to view this event.");
      const accessible = await this.isAccessibleToUser(event, actor.id);
      if (!accessible) throw new ForbiddenError("You don't have permission to view this event.");
      return this.toListItem(event);
    }

    if (!event) throw new NotFoundError('Calendar event not found.');
    if (actor.role === 'TRAINER' && !(await this.repository.isInTrainerViewScope(id, actor.id))) {
      throw new ForbiddenError("You don't have permission to view this event.");
    }
    return this.toListItem(event);
  }

  async listMine(userId: string, filters: CalendarEventListFilters) {
    return this.repository.findMine(userId, filters);
  }

  async create(dto: CreateCalendarEventDto, actor: Actor, ipAddress?: string | null) {
    const departmentIds = dto.departmentIds ?? [];
    const groupIds = dto.groupIds ?? [];
    if (departmentIds.length > 0) await this.assertDepartmentsExist(departmentIds);
    if (groupIds.length > 0) await this.assertGroupsExist(groupIds);
    await this.assertAssignmentsInScope(departmentIds, groupIds, actor);
    this.assertEndAtNotBeforeStartAt(dto.startAt, dto.endAt);

    const created = await this.repository.createWithAssignments(
      {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        allDay: dto.allDay ?? false,
        location: dto.location,
        createdBy: { connect: { id: actor.id } },
      },
      departmentIds,
      groupIds,
    );

    await auditLogService.record({
      action: 'CALENDAR_EVENT_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { eventId: created.id, title: created.title, departmentIds, groupIds },
    });

    await this.notifyAssigned(departmentIds, groupIds, {
      type: 'CALENDAR_EVENT_CREATED',
      title: 'New calendar event',
      message: `"${created.title}" has been added to your calendar.`,
      eventId: created.id,
    });

    return this.toListItem(created);
  }

  async update(id: string, dto: UpdateCalendarEventDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);
    await this.assertEventManageable(id, actor);

    const nextStartAt = dto.startAt !== undefined ? new Date(dto.startAt) : existing.startAt;
    const nextEndAt =
      dto.endAt !== undefined ? (dto.endAt === null ? null : new Date(dto.endAt)) : existing.endAt;
    if (nextEndAt && nextEndAt < nextStartAt) {
      throw new BadRequestError('endAt must be on or after startAt.');
    }

    // Omitting BOTH keys entirely leaves assignments untouched; either key being present
    // replaces the full set (Prompt 6 § PATCH /calendar/events/:id).
    const hasAssignmentUpdate = dto.departmentIds !== undefined || dto.groupIds !== undefined;
    const departmentIds = dto.departmentIds ?? [];
    const groupIds = dto.groupIds ?? [];
    if (hasAssignmentUpdate) {
      if (departmentIds.length > 0) await this.assertDepartmentsExist(departmentIds);
      if (groupIds.length > 0) await this.assertGroupsExist(groupIds);
      await this.assertAssignmentsInScope(departmentIds, groupIds, actor);
    }

    const updated = await this.repository.updateWithAssignments(
      id,
      {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.startAt !== undefined ? { startAt: nextStartAt } : {}),
        ...(dto.endAt !== undefined ? { endAt: nextEndAt } : {}),
        ...(dto.allDay !== undefined ? { allDay: dto.allDay } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
      },
      hasAssignmentUpdate ? { departmentIds, groupIds } : undefined,
    );

    await auditLogService.record({
      action: 'CALENDAR_EVENT_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { eventId: existing.id, changes: { ...dto } },
    });

    // Resolve from `updated.assignments` (the post-transaction state) rather than the DTO —
    // this is correct whether or not the assignment set was actually replaced this call.
    const assignedDepartmentIds = updated.assignments
      .map((assignment) => assignment.departmentId)
      .filter((value): value is string => value !== null);
    const assignedGroupIds = updated.assignments
      .map((assignment) => assignment.groupId)
      .filter((value): value is string => value !== null);

    await this.notifyAssigned(assignedDepartmentIds, assignedGroupIds, {
      type: 'CALENDAR_EVENT_UPDATED',
      title: 'Calendar event updated',
      message: `"${updated.title}" on your calendar has been updated.`,
      eventId: updated.id,
    });

    return this.toListItem(updated);
  }

  async softDelete(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.assertEventManageable(id, actor);
    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'CALENDAR_EVENT_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { eventId: existing.id, title: existing.title },
    });
  }

  private async notifyAssigned(
    departmentIds: string[],
    groupIds: string[],
    input: {
      type: 'CALENDAR_EVENT_CREATED' | 'CALENDAR_EVENT_UPDATED';
      title: string;
      message: string;
      eventId: string;
    },
  ): Promise<void> {
    const userIds = await this.repository.findAssignedUserIds(departmentIds, groupIds);
    if (userIds.length === 0) return;

    // Best-effort: the event is already committed by the time this runs — a transient
    // notification failure must not surface as a failed create/update (which could prompt a
    // client retry and create a duplicate event, since CalendarEvent has no natural uniqueness
    // constraint to reject that the way group/assessment assignments do).
    await notificationsService
      .notifyMany(userIds, {
        type: input.type,
        title: input.title,
        message: input.message,
        relatedEntityType: 'calendar_event',
        relatedEntityId: input.eventId,
      })
      .catch((error: unknown) => {
        logger.error('Failed to send calendar event notifications', {
          error,
          eventId: input.eventId,
          type: input.type,
        });
      });
  }

  private toListItem(event: CalendarEventWithAssignments) {
    const { assignments, ...rest } = event;
    const departments = assignments
      .map((assignment) => assignment.department)
      .filter((department): department is { id: string; name: string } => department !== null);
    const groups = assignments
      .map((assignment) => assignment.group)
      .filter((group): group is { id: string; name: string; code: string } => group !== null);

    return { ...rest, assignments: { departments, groups } };
  }

  private async isAccessibleToUser(event: CalendarEventWithAssignments, userId: string): Promise<boolean> {
    const user = await this.usersRepository.findById(userId);
    if (!user) return false;

    const groupIds = await this.repository.findUserGroupIds(userId);
    return event.assignments.some(
      (assignment) =>
        (assignment.departmentId !== null && assignment.departmentId === user.departmentId) ||
        (assignment.groupId !== null && groupIds.includes(assignment.groupId)),
    );
  }

  private assertEndAtNotBeforeStartAt(startAt: string, endAt?: string): void {
    if (endAt && new Date(endAt) < new Date(startAt)) {
      throw new BadRequestError('endAt must be on or after startAt.');
    }
  }

  private async findOrThrow(id: string): Promise<CalendarEventWithAssignments> {
    const event = await this.repository.findById(id);
    if (!event) throw new NotFoundError('Calendar event not found.');
    return event;
  }

  private async assertDepartmentsExist(departmentIds: string[]): Promise<void> {
    const results = await Promise.all(
      departmentIds.map((departmentId) => this.departmentsRepository.findById(departmentId)),
    );
    const missingIndex = results.findIndex((department) => !department);
    if (missingIndex !== -1)
      throw new BadRequestError(`Department not found: ${departmentIds[missingIndex]}`);
  }

  private async assertGroupsExist(groupIds: string[]): Promise<void> {
    const results = await Promise.all(groupIds.map((groupId) => this.groupsRepository.findById(groupId)));
    const missingIndex = results.findIndex((group) => !group);
    if (missingIndex !== -1) throw new BadRequestError(`Group not found: ${groupIds[missingIndex]}`);
  }

  private async assertEventManageable(eventId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isOwnedBy(eventId, actor.id))) {
      throw new ForbiddenError('A trainer can only modify calendar events they created.');
    }
  }

  private async assertAssignmentsInScope(
    departmentIds: string[],
    groupIds: string[],
    actor: Actor,
  ): Promise<void> {
    if (actor.role !== 'TRAINER') return;

    for (const groupId of groupIds) {
      const group = await this.groupsRepository.findById(groupId);
      if (group?.trainerId !== actor.id) {
        throw new ForbiddenError("You don't have permission to assign events to this group.");
      }
    }
    for (const departmentId of departmentIds) {
      if (!(await this.groupsRepository.isDepartmentInTrainerScope(actor.id, departmentId))) {
        throw new ForbiddenError("You don't have permission to assign events to this department.");
      }
    }
  }
}
