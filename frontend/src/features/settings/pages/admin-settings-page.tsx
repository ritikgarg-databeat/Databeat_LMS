// Admin settings page — mounted only under `/admin`. Composes the same personal settings every
// role gets (Profile/Appearance/Notifications) plus the SUPER_ADMIN-only Platform Settings
// section. `usePlatformSettingsQuery`/`useUpdatePlatformSettingsMutation` are only ever mounted
// here, never on `UserSettingsPage`, since the backend 403s that endpoint for every other role.
import { PersonalSettingsSection, PlatformSettingsCard } from '../components';

function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, appearance, notifications, and platform configuration.
        </p>
      </div>

      <PersonalSettingsSection />
      <PlatformSettingsCard />
    </div>
  );
}

export { AdminSettingsPage };
