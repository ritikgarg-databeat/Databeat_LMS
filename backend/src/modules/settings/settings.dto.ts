import type { NotificationType, ThemePreference } from '@prisma/client';

// Request DTOs (API-facing request-body shapes) for the settings module. Response shapes
// returned by the service layer live in settings.types.ts — this module has no single Prisma
// model of its own for most of its endpoints (theme/avatar live on User, muted types live on
// NotificationPreference), so the response shapes are hand-composed rather than a direct
// `Prisma.XGetPayload`, unlike e.g. the resources module's precedent.

export interface UpdateThemeDto {
  theme: ThemePreference;
}

/**
 * Body for `PATCH /settings/notification-preferences`. There is no "leave unchanged" option —
 * this endpoint always replaces the full muted-types set. `mutedTypes` omitted from the request
 * body entirely is treated the same as `[]` by the controller (see settings.controller.ts), so
 * "unmute everything" can be expressed either way.
 */
export interface UpdateNotificationPreferencesDto {
  mutedTypes?: NotificationType[];
}

/**
 * Body for `PATCH /settings/platform` — every field is a partial update; omitted fields are left
 * unchanged. `supportEmail: null` explicitly clears a previously-set address (distinct from
 * omitting the field, which leaves it untouched).
 */
export interface UpdatePlatformSettingsDto {
  platformName?: string;
  supportEmail?: string | null;
  maintenanceMode?: boolean;
  traineeVideoDailyLimit?: number;
}

export interface UpdateTrainerVideoLimitDto {
  dailyLimit: number | null;
}
