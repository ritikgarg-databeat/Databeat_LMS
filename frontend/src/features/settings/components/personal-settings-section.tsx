// Shared "personal settings" content (Profile, Appearance, Notifications) — every role gets
// this, including SUPER_ADMIN (an admin is also a "user" with their own profile/theme/notification
// preferences). Extracted so `UserSettingsPage` and `AdminSettingsPage` compose it rather than one
// page rendering the other.
import { AppearanceSettingsCard } from './appearance-settings-card';
import { NotificationPreferencesCard } from './notification-preferences-card';
import { ProfileSettingsCard } from './profile-settings-card';

function PersonalSettingsSection() {
  return (
    <div className="space-y-4">
      <ProfileSettingsCard />
      <AppearanceSettingsCard />
      <NotificationPreferencesCard />
    </div>
  );
}

export { PersonalSettingsSection };
