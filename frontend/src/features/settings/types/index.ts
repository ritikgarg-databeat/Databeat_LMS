// TypeScript types and interfaces for the settings feature.
//
// Mirrors backend/src/modules/settings — user-level theme/notification preferences, avatar
// upload, and (SUPER_ADMIN only) platform-wide settings.

/**
 * The 8-value `NotificationType` union defined locally rather than imported from
 * `@/features/notifications/types`: at the time this file was written, that feature's exported
 * union only carried 4 of the 8 backend values (missing `QNA_ANSWER_POSTED`,
 * `QNA_ANSWER_VERIFIED`, `COURSE_ASSIGNED`, `TRAINER_ANNOUNCEMENT` — see
 * `features/notifications/types/index.ts`). If that's since been fixed to carry all 8 values,
 * prefer importing `NotificationType` from there instead and deleting this local copy.
 */
export type NotificationType =
  | 'ASSESSMENT_ASSIGNED'
  | 'ASSESSMENT_DEADLINE_APPROACHING'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_UPDATED'
  | 'QNA_ANSWER_POSTED'
  | 'QNA_ANSWER_VERIFIED'
  | 'COURSE_ASSIGNED'
  | 'TRAINER_ANNOUNCEMENT';

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

/** `GET /settings` response. */
export interface UserSettings {
  theme: ThemePreference;
  mutedNotificationTypes: NotificationType[];
}

/** Body for `PATCH /settings/theme`, and its response shape. */
export interface UpdateThemePayload {
  theme: ThemePreference;
}

/** `GET /settings/notification-preferences` response, and the body/response shape for the PATCH. */
export interface NotificationPreferences {
  mutedTypes: NotificationType[];
}

/** `POST /settings/avatar` response — `avatar` is a relative path/URL, not a full asset. */
export interface UploadAvatarResult {
  avatar: string;
}

/** `GET /settings/platform` / `PATCH /settings/platform` response (SUPER_ADMIN only). */
export interface PlatformSettings {
  platformName: string;
  supportEmail: string | null;
  maintenanceMode: boolean;
  updatedAt: string;
}

/** Body for `PATCH /settings/platform` — every field optional (partial update). */
export type UpdatePlatformSettingsPayload = Partial<
  Pick<PlatformSettings, 'platformName' | 'supportEmail' | 'maintenanceMode'>
>;
