import { TrainerAssessmentStatsCards } from '@/features/assessment/components/trainer-assessment-stats-cards';
import { ClassroomStatsCards } from '@/features/classroom/components/classroom-stats-cards';
import { GroupStatsCards } from '@/features/groups/components';
import { useAuth } from '@/hooks/use-auth';

/** Populated with organization + classroom + assessment stats (Prompt 4/5/6); further widgets land as Analytics is built out. */
function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.fullName ?? 'Admin'}</h1>
        <p className="text-muted-foreground">Platform-wide overview.</p>
      </div>
      <GroupStatsCards />
      <ClassroomStatsCards />
      <TrainerAssessmentStatsCards />
    </div>
  );
}

export { AdminDashboardPage };
