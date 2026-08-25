export { default as settingsRoutes } from './settings.routes';

export { SettingsService, settingsService } from './settings.service';
export type {
  UpdateNotificationPreferencesDto,
  UpdatePlatformSettingsDto,
  UpdateThemeDto,
  UpdateTrainerVideoLimitDto,
} from './settings.dto';
export type {
  AvatarResult,
  NotificationPreferencesResult,
  PlatformSettingsResult,
  SettingsSummary,
  ThemeResult,
  TrainerVideoLimitResult,
} from './settings.types';
