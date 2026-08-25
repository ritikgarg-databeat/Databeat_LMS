// Personal settings page — mounted for every role (trainee/trainer/admin all get this at
// their own `.../settings` route). Trainer's "Profile, Notification preferences" from the
// build spec is covered by `PersonalSettingsSection` (Profile + Appearance + Notifications);
// "Default settings" has no backend contract in this prompt's scope and is intentionally
// left out rather than faked (see AdminSettingsPage's sibling doc comment for the same call).
import { ROLES } from '@/constants/roles';
import { useAuth } from '@/hooks/use-auth';

import { PersonalSettingsSection, TrainerVideoLimitCard } from '../components';

function UserSettingsPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile, appearance, and notifications.</p>
      </div>

      <PersonalSettingsSection />
      {user?.role === ROLES.TRAINER ? <TrainerVideoLimitCard /> : null}
    </div>
  );
}

export { UserSettingsPage };
