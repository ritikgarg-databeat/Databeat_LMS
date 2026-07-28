import path from 'node:path';
import type { Readable } from 'node:stream';

import type { NotificationType, ThemePreference } from '@prisma/client';

import { AVATAR_ENTITY_TYPE, AVATAR_MIME_TYPE_BY_EXTENSION } from '@/constants/settings';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import { NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

import type { UpdatePlatformSettingsDto } from './settings.dto';
import { SettingsRepository } from './settings.repository';
import type {
  AvatarResult,
  NotificationPreferencesResult,
  PlatformSettingsResult,
  SettingsSummary,
  ThemeResult,
} from './settings.types';

/** How long a cached `maintenanceMode` read is trusted before re-hitting the DB — see
 * `isMaintenanceModeActive()`. Short enough that a toggle is felt almost immediately across every
 * in-flight server process, long enough that it isn't a DB round trip on every authenticated
 * request (this is checked from `authenticate` — effectively every API call in the app). */
const MAINTENANCE_MODE_CACHE_TTL_MS = 5_000;

// Business logic for the settings module. Controllers call into this layer only.
export class SettingsService extends BaseService {
  private maintenanceModeCache: { value: boolean; expiresAt: number } | null = null;

  constructor(protected readonly repository: SettingsRepository = new SettingsRepository()) {
    super();
  }

  async getSummary(userId: string): Promise<SettingsSummary> {
    const user = await this.repository.findUserThemeAndAvatar(userId);
    if (!user) throw new NotFoundError('User not found.');

    const preference = await this.repository.findNotificationPreference(userId);
    return {
      theme: user.themePreference,
      mutedNotificationTypes: preference?.mutedTypes ?? [],
    };
  }

  async updateTheme(userId: string, theme: ThemePreference): Promise<ThemeResult> {
    const updated = await this.repository.updateTheme(userId, theme);
    return { theme: updated.themePreference };
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferencesResult> {
    const preference = await this.repository.findNotificationPreference(userId);
    return { mutedTypes: preference?.mutedTypes ?? [] };
  }

  async updateNotificationPreferences(
    userId: string,
    mutedTypes: NotificationType[],
  ): Promise<NotificationPreferencesResult> {
    const updated = await this.repository.upsertNotificationPreference(userId, mutedTypes);
    return { mutedTypes: updated.mutedTypes };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<AvatarResult> {
    const existing = await this.repository.findUserAvatar(userId);
    await this.deleteOldAvatarBestEffort(existing?.avatar ?? null);

    const { relativePath } = await storageProvider.save({
      buffer: file.buffer,
      originalName: file.originalname,
      entityType: AVATAR_ENTITY_TYPE,
    });

    await this.repository.updateAvatar(userId, relativePath);
    return { avatar: relativePath };
  }

  async removeAvatar(userId: string): Promise<void> {
    const existing = await this.repository.findUserAvatar(userId);
    await this.deleteOldAvatarBestEffort(existing?.avatar ?? null);
    await this.repository.updateAvatar(userId, null);
  }

  /**
   * Streams the caller's own avatar bytes back — mirrors `resources.service.ts#download`'s
   * stream-plus-content-type shape. `User.avatar` has no matching MIME-type column, so
   * `Content-Type` is reconstructed from the stored file's extension via
   * `AVATAR_MIME_TYPE_BY_EXTENSION`, falling back to a generic binary type for the practically
   * unreachable case of an unrecognized extension (`generateSafeFilename` only ever writes one of
   * the four accepted extensions at upload time).
   */
  async getAvatarStream(userId: string): Promise<{ stream: Readable; mimeType: string }> {
    const user = await this.repository.findUserAvatar(userId);
    // Same `isOwnedAvatarPath` check `deleteOldAvatarBestEffort` uses: `User.avatar` may hold a
    // full external URL set via the pre-existing profile page's "Avatar URL" field rather than a
    // path this module's upload endpoint wrote — that's directly fetchable by the browser and
    // must never be treated as a local storage path here (the frontend also short-circuits this
    // case in `useAuthenticatedAvatarUrl` before ever calling this endpoint).
    if (!user?.avatar || !this.isOwnedAvatarPath(user.avatar)) {
      throw new NotFoundError('No avatar set.');
    }

    const stream = await storageProvider.getReadStream({ relativePath: user.avatar });
    const extension = path.extname(user.avatar).toLowerCase();
    const mimeType = AVATAR_MIME_TYPE_BY_EXTENSION[extension] ?? 'application/octet-stream';
    return { stream, mimeType };
  }

  async getPlatformSettings(): Promise<PlatformSettingsResult> {
    const settings = (await this.repository.findPlatformSettings()) ?? (await this.repository.createDefaultPlatformSettings());
    return this.toPlatformSettingsResult(settings);
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto, actorId: string): Promise<PlatformSettingsResult> {
    const updated = await this.repository.upsertPlatformSettings(dto, actorId);
    // Invalidate immediately rather than waiting out the TTL, so a Super Admin toggling
    // maintenance mode off (to unblock everyone else, or themselves) takes effect on their very
    // next request rather than up to MAINTENANCE_MODE_CACHE_TTL_MS later.
    this.maintenanceModeCache = null;
    return this.toPlatformSettingsResult(updated);
  }

  /** Read by `requireNotInMaintenance` (middleware/maintenance-mode.middleware.ts) on effectively
   * every authenticated request, so the result is cached briefly rather than hitting the DB each
   * time — see `MAINTENANCE_MODE_CACHE_TTL_MS`. */
  async isMaintenanceModeActive(): Promise<boolean> {
    const now = Date.now();
    if (this.maintenanceModeCache && this.maintenanceModeCache.expiresAt > now) {
      return this.maintenanceModeCache.value;
    }

    const settings = await this.getPlatformSettings();
    this.maintenanceModeCache = { value: settings.maintenanceMode, expiresAt: now + MAINTENANCE_MODE_CACHE_TTL_MS };
    return settings.maintenanceMode;
  }

  /**
   * Best-effort: deletes the previous avatar file from storage before the new one is saved (or
   * before the avatar is cleared), but only if it looks like a file WE stored — namespaced under
   * `AVATAR_ENTITY_TYPE`. `User.avatar` is a plain nullable string with no other constraint on
   * its shape, so any other value (legacy/seed data, a future externally-hosted URL) is left
   * untouched. A file already missing on disk must never block the avatar change itself — mirrors
   * resources.service.ts#remove's identical try/catch-and-log pattern for lesson resource files.
   */
  private async deleteOldAvatarBestEffort(oldAvatar: string | null): Promise<void> {
    if (!oldAvatar || !this.isOwnedAvatarPath(oldAvatar)) return;

    await storageProvider.delete({ relativePath: oldAvatar }).catch((error: unknown) => {
      logger.error('Failed to delete old avatar file from storage', { error, relativePath: oldAvatar });
    });
  }

  private isOwnedAvatarPath(relativePath: string): boolean {
    return relativePath.replace(/\\/g, '/').startsWith(`${AVATAR_ENTITY_TYPE}/`);
  }

  private toPlatformSettingsResult(settings: {
    platformName: string;
    supportEmail: string | null;
    maintenanceMode: boolean;
    updatedAt: Date;
  }): PlatformSettingsResult {
    return {
      platformName: settings.platformName,
      supportEmail: settings.supportEmail,
      maintenanceMode: settings.maintenanceMode,
      updatedAt: settings.updatedAt,
    };
  }
}

export const settingsService = new SettingsService();
