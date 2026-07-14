// Personal settings page — mounted for every role (trainee/trainer/admin all get this at
// their own `.../settings` route). Trainer's "Profile, Notification preferences" from the
// build spec is covered by `PersonalSettingsSection` (Profile + Appearance + Notifications);
// "Default settings" has no backend contract in this prompt's scope and is intentionally
// left out rather than faked (see AdminSettingsPage's sibling doc comment for the same call).
import { PersonalSettingsSection } from '../components';

function UserSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile, appearance, and notifications.</p>
      </div>

      <PersonalSettingsSection />
    </div>
  );
}

export { UserSettingsPage };
