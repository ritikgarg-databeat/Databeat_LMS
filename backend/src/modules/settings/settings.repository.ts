import type { NotificationType, ThemePreference } from '@prisma/client';

import { PLATFORM_SETTINGS_SINGLETON_ID } from '@/constants/settings';
import { BaseRepository } from '@/repositories/base.repository';

/** Partial update applied to the singleton `PlatformSettings` row — every field optional, omitted fields left unchanged. */
export interface PlatformSettingsPatch {
  platformName?: string;
  supportEmail?: string | null;
  maintenanceMode?: boolean;
}

// Data-access layer for the settings module. Only this class may query Prisma directly (see
// ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
//
// Reads/writes `User.themePreference` / `User.avatar` and the `NotificationPreference` model
// directly rather than importing from the users/notifications modules — feature-local
// duplication over premature cross-module coupling, the same convention resources.repository.ts
// follows for `Lesson` and progress.repository.ts follows elsewhere in this codebase.
export class SettingsRepository extends BaseRepository {
  findUserThemeAndAvatar(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { themePreference: true, avatar: true },
    });
  }

  updateTheme(userId: string, theme: ThemePreference) {
    return this.db.user.update({
      where: { id: userId },
      data: { themePreference: theme },
      select: { themePreference: true },
    });
  }

  findUserAvatar(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: { avatar: true } });
  }

  updateAvatar(userId: string, avatar: string | null) {
    return this.db.user.update({ where: { id: userId }, data: { avatar }, select: { avatar: true } });
  }

  findNotificationPreference(userId: string) {
    return this.db.notificationPreference.findUnique({ where: { userId }, select: { mutedTypes: true } });
  }

  /** One row per user, created lazily on first write (schema.prisma's documented "absent =
   * nothing muted" convention) — `upsert` on the `userId` unique constraint handles both cases. */
  upsertNotificationPreference(userId: string, mutedTypes: NotificationType[]) {
    return this.db.notificationPreference.upsert({
      where: { userId },
      create: { user: { connect: { id: userId } }, mutedTypes },
      update: { mutedTypes },
      select: { mutedTypes: true },
    });
  }

  findPlatformSettings() {
    return this.db.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_SINGLETON_ID } });
  }

  /**
   * Lazily materializes the singleton row using the schema's column defaults — called only when
   * `findPlatformSettings` returns null. `upsert` (not `create`) so two requests racing to
   * materialize the row for the first time (e.g. two admins opening the settings screen at once)
   * resolve atomically via Postgres `INSERT ... ON CONFLICT DO UPDATE` instead of one of them
   * throwing an unhandled unique-constraint error.
   */
  createDefaultPlatformSettings() {
    return this.db.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_SINGLETON_ID },
      create: { id: PLATFORM_SETTINGS_SINGLETON_ID },
      update: {},
    });
  }

  /**
   * `patch` is rebuilt key-by-key (never spread wholesale) before reaching Prisma — `req.body` is
   * cast to `PlatformSettingsPatch` in the controller without stripping unknown properties, so a
   * caller-supplied `id` (or any other extra field) must never be able to ride along and rewrite
   * the fixed singleton row's primary key.
   */
  upsertPlatformSettings(patch: PlatformSettingsPatch, updatedById: string) {
    const fields: PlatformSettingsPatch = {};
    if (patch.platformName !== undefined) fields.platformName = patch.platformName;
    if (patch.supportEmail !== undefined) fields.supportEmail = patch.supportEmail;
    if (patch.maintenanceMode !== undefined) fields.maintenanceMode = patch.maintenanceMode;

    return this.db.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_SINGLETON_ID },
      create: { id: PLATFORM_SETTINGS_SINGLETON_ID, ...fields, updatedById },
      update: { ...fields, updatedById },
    });
  }
}
