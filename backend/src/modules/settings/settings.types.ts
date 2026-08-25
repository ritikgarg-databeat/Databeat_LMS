import type { NotificationType, ThemePreference } from '@prisma/client';

// Internal domain types for the settings module — response shapes returned by
// settings.service.ts. Request-body shapes live in settings.dto.ts.

export interface SettingsSummary {
  theme: ThemePreference;
  mutedNotificationTypes: NotificationType[];
}

export interface ThemeResult {
  theme: ThemePreference;
}

export interface NotificationPreferencesResult {
  mutedTypes: NotificationType[];
}

export interface AvatarResult {
  avatar: string;
}

/**
 * Hand-shaped subset of the `PlatformSettings` model returned to callers — deliberately omits
 * `id` (always the fixed singleton constant, meaningless to a client) and `updatedById` (an
 * internal actor id with no use on the admin settings screen).
 */
export interface PlatformSettingsResult {
  platformName: string;
  supportEmail: string | null;
  maintenanceMode: boolean;
  traineeVideoDailyLimit: number;
  updatedAt: Date;
}

export interface TrainerVideoLimitResult {
  dailyLimit: number | null;
  platformMaximum: number;
}
