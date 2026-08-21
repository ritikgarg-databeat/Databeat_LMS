import { Role, type User } from '@prisma/client';

import type { SafeUser } from '@/modules/auth/auth.types';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';
import { generateTemporaryPassword, hashPassword } from '@/utils/password.util';
import { toSafeUser } from '@/utils/user-mapper.util';

import type {
  ChangeRoleDto,
  CreateUserDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
  UpdateOwnProfileDto,
  UpdateUserDto,
} from './users.dto';
import { UsersRepository } from './users.repository';
import type { SortOrder, UserListFilters, UserSortField } from './users.types';

export interface Actor {
  id: string;
  role: Role;
}

/** The role an actor is allowed to create/update/deactivate/reset-password for (§ USER MANAGEMENT). */
function managedRoleFor(actorRole: Role): Role {
  if (actorRole === Role.TRAINER) return Role.TRAINEE;
  if (actorRole === Role.SUPER_ADMIN) return Role.TRAINER;
  throw new ForbiddenError("You don't have permission to manage users.");
}

// Business logic for the users module. Controllers call into this layer only.
export class UsersService extends BaseService {
  constructor(protected readonly repository: UsersRepository = new UsersRepository()) {
    super();
  }

  async list(
    actor: Actor,
    filters: UserListFilters,
    page: number,
    pageSize: number,
    sortBy: UserSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<SafeUser>> {
    // Trainers default to seeing only trainees (§ USER MANAGEMENT TRAINER — "List trainees"),
    // EXCEPT when they explicitly ask for `role=TRAINER` themselves — that's the legitimate
    // "pick a trainer to assign to this group" dropdown (features/groups), not the trainee
    // roster, and must return real trainers rather than silently substituting trainees. Any
    // other explicit role request (or no role filter at all) from a Trainer still collapses to
    // TRAINEE — they're never allowed to browse the trainee list scoped to something else, or
    // to fish for SUPER_ADMIN accounts by requesting that role explicitly. Super Admin's
    // "View all users" stays unrestricted unless it explicitly narrows by role itself.
    const effectiveFilters: UserListFilters =
      actor.role === Role.TRAINER && filters.role !== Role.TRAINER
        ? { ...filters, role: Role.TRAINEE }
        : filters;

    const { items, total } = await this.repository.findMany(
      effectiveFilters,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
      actor.role === Role.TRAINER ? actor.id : undefined,
    );

    return { items: items.map(toSafeUser), meta: buildPaginationMeta(page, pageSize, total) };
  }

  async getById(actor: Actor, targetId: string): Promise<SafeUser> {
    const target = await this.findOrThrow(targetId);

    const canView =
      actor.role === Role.SUPER_ADMIN ||
      (actor.role === Role.TRAINER &&
        target.role === Role.TRAINEE &&
        (await this.repository.isTraineeManagedByTrainer(target.id, actor.id)));
    if (!canView) {
      throw new ForbiddenError("You don't have permission to view this user.");
    }

    return toSafeUser(target);
  }

  async create(actor: Actor, dto: CreateUserDto, ipAddress?: string | null): Promise<SafeUser> {
    const allowedRole = managedRoleFor(actor.role);
    if (dto.role !== allowedRole) {
      throw new ForbiddenError(`You can only create users with the ${allowedRole} role.`);
    }
    if (
      actor.role === Role.TRAINER &&
      dto.departmentId &&
      !(await this.repository.isDepartmentInTrainerScope(dto.departmentId, actor.id))
    ) {
      throw new ForbiddenError("You don't have permission to create users in this department.");
    }

    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('A user with this email already exists.');
    }

    const passwordHash = await hashPassword(dto.password);
    const created = await this.repository.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      passwordHash,
      role: dto.role,
      ...(dto.departmentId ? { department: { connect: { id: dto.departmentId } } } : {}),
      ...(dto.experienceLevelId ? { experienceLevel: { connect: { id: dto.experienceLevelId } } } : {}),
    });

    await auditLogService.record({
      action: 'USER_CREATED',
      actorId: actor.id,
      targetUserId: created.id,
      ipAddress,
      metadata: { role: created.role },
    });

    return toSafeUser(created);
  }

  async update(
    actor: Actor,
    targetId: string,
    dto: UpdateUserDto,
    ipAddress?: string | null,
  ): Promise<SafeUser> {
    const target = await this.assertCanManage(actor, targetId);
    if (
      actor.role === Role.TRAINER &&
      dto.departmentId &&
      !(await this.repository.isDepartmentInTrainerScope(dto.departmentId, actor.id))
    ) {
      throw new ForbiddenError("You don't have permission to move this user to that department.");
    }

    const updated = await this.repository.update(target.id, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      ...(dto.departmentId !== undefined
        ? { department: dto.departmentId ? { connect: { id: dto.departmentId } } : { disconnect: true } }
        : {}),
      ...(dto.experienceLevelId !== undefined
        ? {
            experienceLevel: dto.experienceLevelId
              ? { connect: { id: dto.experienceLevelId } }
              : { disconnect: true },
          }
        : {}),
    });

    await auditLogService.record({
      action: 'USER_UPDATED',
      actorId: actor.id,
      targetUserId: target.id,
      ipAddress,
    });

    return toSafeUser(updated);
  }

  async updateOwnProfile(actorId: string, dto: UpdateOwnProfileDto): Promise<SafeUser> {
    const updated = await this.repository.update(actorId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatar: dto.avatar,
    });
    return toSafeUser(updated);
  }

  async deactivate(actor: Actor, targetId: string, ipAddress?: string | null): Promise<SafeUser> {
    const target = await this.assertCanManage(actor, targetId);
    const updated = await this.repository.setActive(target.id, false);
    await this.repository.revokeAllRefreshTokens(target.id);

    await auditLogService.record({
      action: 'USER_DEACTIVATED',
      actorId: actor.id,
      targetUserId: target.id,
      ipAddress,
    });

    return toSafeUser(updated);
  }

  async reactivate(actor: Actor, targetId: string, ipAddress?: string | null): Promise<SafeUser> {
    const target = await this.assertCanManage(actor, targetId);
    const updated = await this.repository.setActive(target.id, true);

    await auditLogService.record({
      action: 'USER_REACTIVATED',
      actorId: actor.id,
      targetUserId: target.id,
      ipAddress,
    });

    return toSafeUser(updated);
  }

  async resetPassword(
    actor: Actor,
    targetId: string,
    dto: ResetPasswordDto,
    ipAddress?: string | null,
  ): Promise<ResetPasswordResponseDto> {
    const target = await this.assertCanManage(actor, targetId);

    const generated = dto.newPassword ? undefined : generateTemporaryPassword();
    const passwordHash = await hashPassword(dto.newPassword ?? generated!);

    await this.repository.updatePassword(target.id, passwordHash);
    await this.repository.revokeAllRefreshTokens(target.id);

    await auditLogService.record({
      action: 'PASSWORD_RESET_BY_ADMIN',
      actorId: actor.id,
      targetUserId: target.id,
      ipAddress,
    });

    return generated ? { temporaryPassword: generated } : {};
  }

  /** Super Admin only — the one exception to the strict "admin manages trainers only" rule. */
  async changeRole(
    actor: Actor,
    targetId: string,
    dto: ChangeRoleDto,
    ipAddress?: string | null,
  ): Promise<SafeUser> {
    if (actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenError('Only a Super Admin can change user roles.');
    }
    if (targetId === actor.id) {
      throw new ForbiddenError('You cannot change your own role.');
    }

    const target = await this.findOrThrow(targetId);
    if (target.role === Role.SUPER_ADMIN) {
      throw new ForbiddenError('Super Admin roles cannot be changed through this endpoint.');
    }

    const updated = await this.repository.update(target.id, { role: dto.role });

    await auditLogService.record({
      action: 'USER_ROLE_CHANGED',
      actorId: actor.id,
      targetUserId: target.id,
      ipAddress,
      metadata: { from: target.role, to: dto.role },
    });

    return toSafeUser(updated);
  }

  private async findOrThrow(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User not found.');
    return user;
  }

  private async assertCanManage(actor: Actor, targetId: string): Promise<User> {
    const allowedRole = managedRoleFor(actor.role);
    const target = await this.findOrThrow(targetId);

    if (target.role !== allowedRole) {
      throw new ForbiddenError("You don't have permission to manage this user.");
    }
    if (
      actor.role === Role.TRAINER &&
      !(await this.repository.isTraineeManagedByTrainer(target.id, actor.id))
    ) {
      throw new ForbiddenError("You don't have permission to manage this user.");
    }

    return target;
  }
}
