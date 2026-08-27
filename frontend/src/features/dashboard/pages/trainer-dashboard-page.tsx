import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { AlertTriangle, ClipboardCheck, Trophy, Users } from 'lucide-react';

import { ErrorScreen } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { AiUsageOverviewCard } from '@/features/ai/components';
import { useTrainerDashboardQuery } from '@/features/analytics/hooks';
import type { GroupAnalyticsRow, TrainerDashboard } from '@/features/analytics/types';
import { TrainerQnaWidget } from '@/features/qna/components';
import { useAuth } from '@/hooks/use-auth';

import { DeferredDashboardSection } from '../components/deferred-dashboard-section';
import type { RecentActivityItem } from '../components/recent-activity-widget';
import { RecentActivityWidget } from '../components/recent-activity-widget';
import { TrainerGroupAnalyticsTable } from '../components/trainer-group-analytics-table';
import { TrainerInsightsCard } from '../components/trainer-insights-card';
import { TrainerLeaderboardCard } from '../components/trainer-leaderboard-card';
import { TrainerOverviewCards } from '../components/trainer-overview-cards';
import { TrainerPendingGradingAlert } from '../components/trainer-pending-grading-alert';
import { TrainerQuickActions } from '../components/trainer-quick-actions';
import { TrainerReportsTeaserCard } from '../components/trainer-reports-teaser-card';

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

/**
 * Builds a short "attention" feed purely from fields the trainer dashboard query already returns
 * — no new endpoint. Sources: `pendingGradingCount`, `groups[].activeUsers7d`/`.lastActivityAt`/
 * `.name`/`.groupId`, and `leaderboard.items[0]` (top performer).
 */
function buildTrainerActivityItems(data: TrainerDashboard): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];

  if (data.pendingGradingCount > 0) {
    items.push({
      id: 'pending-grading',
      icon: ClipboardCheck,
      text: `${data.pendingGradingCount} ${data.pendingGradingCount === 1 ? 'attempt' : 'attempts'} awaiting manual grading`,
      tone: 'warning',
    });
  }

  const idleGroups = data.groups.filter((group) => group.activeUsers7d === 0);
  if (idleGroups.length > 0) {
    items.push({
      id: 'idle-groups',
      icon: AlertTriangle,
      text: `${idleGroups.length} ${idleGroups.length === 1 ? 'group has' : 'groups have'} had no active learners this week`,
      tone: 'warning',
    });
  }

  const topEntry = data.leaderboard.items[0];
  if (topEntry) {
    items.push({
      id: `leaderboard-${topEntry.userId}`,
      icon: Trophy,
      text: `${topEntry.name} leads the leaderboard with a performance score of ${Math.round(topEntry.performanceScore)}`,
      tone: 'success',
    });
  }

  const recentGroups: RecentActivityItem[] = data.groups
    .filter((group): group is GroupAnalyticsRow & { lastActivityAt: string } => Boolean(group.lastActivityAt))
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    .slice(0, 3)
    .map((group) => ({
      id: `group-${group.groupId}`,
      icon: Users,
      text: `${group.name} was last active`,
      timestamp: group.lastActivityAt,
      tone: 'default',
    }));

  return [...items, ...recentGroups].slice(0, 5);
}

/**
 * Trainer dashboard (Prompt 8) — rebuilt around a single `useTrainerDashboardQuery()` call.
 * Keeps the Q&A and AI usage widgets mounted from Prompt 7; the group/classroom/assessment stat
 * rows those replaced (`GroupStatsCards`/`ClassroomStatsCards`/`TrainerAssessmentStatsCards`)
 * stay in the codebase for admin surfaces, just no longer imported here.
 */
function TrainerDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useTrainerDashboardQuery();
  const shouldReduceMotion = useReducedMotion();

  if (isError) {
    return <ErrorScreen message="Failed to load the trainer dashboard." onRetry={() => void refetch()} />;
  }

  const containerMotionProps = shouldReduceMotion
    ? {}
    : { initial: 'hidden', animate: 'visible', variants: containerVariants };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const newSectionMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.25, ease: 'easeOut' as const },
      };

  return (
    <motion.div {...containerMotionProps} className="space-y-4">
      <motion.div {...itemMotionProps}>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.fullName ?? 'Trainer'}</h1>
        <p className="text-muted-foreground">Your groups, trainees, and performance at a glance.</p>
      </motion.div>

      <motion.div {...itemMotionProps}>
        <TrainerOverviewCards overview={data?.overview} isLoading={isLoading} />
      </motion.div>

      {data && data.pendingGradingCount > 0 ? (
        <motion.div {...itemMotionProps}>
          <TrainerPendingGradingAlert count={data.pendingGradingCount} />
        </motion.div>
      ) : null}

      <motion.div {...itemMotionProps} className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrainerGroupAnalyticsTable groups={data?.groups} isLoading={isLoading} />
        </div>
        <TrainerLeaderboardCard entries={data?.leaderboard.items} isLoading={isLoading} />
      </motion.div>

      <motion.div {...itemMotionProps} className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrainerInsightsCard insights={data?.insights} isLoading={isLoading} />
        </div>
        <TrainerReportsTeaserCard />
      </motion.div>

      <motion.div {...itemMotionProps}>
        <DeferredDashboardSection placeholderClassName="h-64">
          <TrainerQnaWidget />
        </DeferredDashboardSection>
      </motion.div>
      <motion.div {...itemMotionProps}>
        <DeferredDashboardSection>
          <AiUsageOverviewCard />
        </DeferredDashboardSection>
      </motion.div>

      {/* New sections (Prompt 9 § Part A) — appended below existing sections, not reordered. */}
      <motion.div {...newSectionMotionProps}>
        {data ? (
          <TrainerQuickActions pendingGradingCount={data.pendingGradingCount} />
        ) : (
          <Skeleton className="h-32 w-full" />
        )}
      </motion.div>

      <motion.div {...newSectionMotionProps}>
        {data ? (
          <RecentActivityWidget items={buildTrainerActivityItems(data)} />
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </motion.div>
    </motion.div>
  );
}

export { TrainerDashboardPage };
