import { TrainerAssessmentStatsCards } from '@/features/assessment/components/trainer-assessment-stats-cards';
import { ClassroomStatsCards } from '@/features/classroom/components/classroom-stats-cards';
import { GroupStatsCards } from '@/features/groups/components';

/** Populated with organization + classroom + assessment stats (Prompt 4/5/6); further widgets land as Analytics is built out. */
function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform-wide overview.</p>
      </div>
      <GroupStatsCards />
      <ClassroomStatsCards />
      <TrainerAssessmentStatsCards />
    </div>
  );
}

export { AdminDashboardPage };
