import { Award, BookOpen, ClipboardCheck, Layers, TrendingUp, Users } from 'lucide-react';

import { StatCard } from '@/components/shared';
import { formatPercent, seriesVar } from '@/features/analytics/components';
import type { TrainerOverview } from '@/features/analytics/types';

export interface TrainerOverviewCardsProps {
  overview: TrainerOverview | undefined;
  isLoading: boolean;
}

/**
 * Trainer dashboard overview row (Prompt 8 § Overview Cards) — six StatCards from one query.
 * Each metric wears a fixed, distinct `--viz-series-*` slot (same colorblind-validated palette
 * the analytics charts use) rather than one repeated neutral gray square: these six numbers are
 * genuinely different categories of thing (people, groups, content, assessments, two performance
 * measures), so variety aids at-a-glance scanning here more than a single flat tint would.
 */
function TrainerOverviewCards({ overview, isLoading }: TrainerOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard
        label="Total Trainees"
        value={overview?.totalTrainees ?? 0}
        icon={Users}
        isLoading={isLoading}
        accentColor={seriesVar(1)}
      />
      <StatCard
        label="Total Groups"
        value={overview?.totalGroups ?? 0}
        icon={Layers}
        isLoading={isLoading}
        accentColor={seriesVar(2)}
      />
      <StatCard
        label="Total Courses"
        value={overview?.totalCourses ?? 0}
        icon={BookOpen}
        isLoading={isLoading}
        accentColor={seriesVar(3)}
      />
      <StatCard
        label="Active Assessments"
        value={overview?.activeAssessments ?? 0}
        icon={ClipboardCheck}
        isLoading={isLoading}
        accentColor={seriesVar(4)}
      />
      <StatCard
        label="Avg Completion"
        value={overview ? formatPercent(overview.averageCompletion) : '—'}
        icon={TrendingUp}
        isLoading={isLoading}
        accentColor={seriesVar(5)}
      />
      <StatCard
        label="Avg Score"
        value={overview && overview.averageScore !== null ? formatPercent(overview.averageScore) : '—'}
        icon={Award}
        isLoading={isLoading}
        accentColor={seriesVar(6)}
      />
    </div>
  );
}

export { TrainerOverviewCards };
