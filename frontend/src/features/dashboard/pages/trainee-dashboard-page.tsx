import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { CheckCircle2, ClipboardList, PlayCircle, XCircle } from 'lucide-react';

import { ErrorScreen } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { AiTutorWidget } from '@/features/ai/components';
import { formatPercent } from '@/features/analytics/components';
import { useTraineeDashboardQuery } from '@/features/analytics/hooks';
import type { ContinueLearningItem, RecentAssessmentResult, TraineeDashboard } from '@/features/analytics/types';
import { MyQuestionsWidget, RecentVerifiedAnswersWidget } from '@/features/qna/components';

import type { RecentActivityItem } from '../components/recent-activity-widget';
import { RecentActivityWidget } from '../components/recent-activity-widget';
import { TraineeAssessmentOverview } from '../components/trainee-assessment-overview';
import { TraineeContinueLearning } from '../components/trainee-continue-learning';
import { TraineeMyCourses } from '../components/trainee-my-courses';
import { TraineeQnaActivity } from '../components/trainee-qna-activity';
import { TraineeQuickActions } from '../components/trainee-quick-actions';
import { TraineeRecommendationsCard } from '../components/trainee-recommendations-card';
import { TraineeUpcomingEvents } from '../components/trainee-upcoming-events';
import { TraineeWelcomeHeader } from '../components/trainee-welcome-header';

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

/**
 * Builds a short "recent activity" list purely from fields the trainee dashboard query already
 * returns — no new endpoint. Sources: `continueLearning[].lastViewedAt` (lesson resumed/viewed)
 * and `assessments.recentResults[].submittedAt` (assessment submitted), merged and sorted by time.
 */
function buildTraineeActivityItems(data: TraineeDashboard): RecentActivityItem[] {
  const lessonEvents: RecentActivityItem[] = data.continueLearning
    .filter((item): item is ContinueLearningItem & { lastViewedAt: string } => Boolean(item.lastViewedAt))
    .map((item) => ({
      id: `lesson-${item.lessonId}`,
      icon: PlayCircle,
      text: `Continued "${item.lessonTitle}" in ${item.courseTitle}`,
      timestamp: item.lastViewedAt,
      tone: 'default',
    }));

  const resultEvents: RecentActivityItem[] = data.assessments.recentResults
    .filter((result): result is RecentAssessmentResult & { submittedAt: string } => Boolean(result.submittedAt))
    .map((result) => ({
      id: `result-${result.assessmentId}`,
      icon: result.passed === true ? CheckCircle2 : result.passed === false ? XCircle : ClipboardList,
      text:
        result.percentage === null
          ? `Submitted "${result.title}"`
          : `Scored ${formatPercent(result.percentage)} on "${result.title}"`,
      timestamp: result.submittedAt,
      tone: result.passed === true ? 'success' : result.passed === false ? 'destructive' : 'default',
    }));

  return [...lessonEvents, ...resultEvents]
    .sort((a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime())
    .slice(0, 5);
}

/** First-load skeleton mirroring the page's section shapes (isLoading only — never on refetch). */
function TraineeDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-56" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-72 shrink-0" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Trainee dashboard — a single `useTraineeDashboardQuery()` call drives every section below, so
 * the individual widgets are presentational (props, not their own queries). Prompt 7's AI Tutor
 * and Q&amp;A widgets keep fetching independently at the bottom, unchanged.
 */
function TraineeDashboardPage() {
  const { data, isLoading, isError, refetch } = useTraineeDashboardQuery();
  const shouldReduceMotion = useReducedMotion();

  if (isLoading) {
    return <TraineeDashboardSkeleton />;
  }

  if (isError || !data) {
    return <ErrorScreen message="Failed to load your dashboard." onRetry={() => void refetch()} />;
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
    <motion.div {...containerMotionProps} className="space-y-6">
      <motion.div {...itemMotionProps}>
        <TraineeWelcomeHeader welcome={data.welcome} />
      </motion.div>

      <motion.div {...itemMotionProps}>
        <TraineeContinueLearning items={data.continueLearning} />
      </motion.div>

      <motion.div {...itemMotionProps}>
        <TraineeMyCourses courses={data.myCourses} />
      </motion.div>

      <motion.div {...itemMotionProps}>
        <TraineeAssessmentOverview assessments={data.assessments} />
      </motion.div>

      <motion.div {...itemMotionProps} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TraineeUpcomingEvents events={data.upcomingEvents} />
        <TraineeRecommendationsCard recommendations={data.recommendations} />
      </motion.div>

      <motion.div {...itemMotionProps}>
        <TraineeQnaActivity qnaActivity={data.qnaActivity} />
      </motion.div>

      <motion.div {...itemMotionProps}>
        <AiTutorWidget />
      </motion.div>
      <motion.div {...itemMotionProps} className="grid gap-4 lg:grid-cols-2">
        <MyQuestionsWidget />
        <RecentVerifiedAnswersWidget />
      </motion.div>

      {/* New sections (Prompt 9 § Part A) — appended below existing sections, not reordered. */}
      <motion.div {...newSectionMotionProps}>
        <TraineeQuickActions continueLearning={data.continueLearning} />
      </motion.div>

      <motion.div {...newSectionMotionProps}>
        <RecentActivityWidget items={buildTraineeActivityItems(data)} />
      </motion.div>
    </motion.div>
  );
}

export { TraineeDashboardPage };
