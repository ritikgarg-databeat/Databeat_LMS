import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BarChart3, ClipboardList, MessageCircleQuestion, PlayCircle, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/constants/routes';
import type { ContinueLearningItem } from '@/features/analytics/types';
import { cn } from '@/lib/utils';

export interface TraineeQuickActionsProps {
  continueLearning: ContinueLearningItem[];
}

interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  /** Defaults to `false` (primary tint) — only the AI shortcut opts into the coral brand accent
   *  below, so the one AI-flavored feature reads as distinct rather than every tile competing. */
  isAiFlavored?: boolean;
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
};

/**
 * Trainee dashboard shortcut row (Prompt 9 § Part A) — purely navigational, no data of its own
 * beyond `continueLearning` (used only to target the first in-progress lesson, if any exists).
 */
function TraineeQuickActions({ continueLearning }: TraineeQuickActionsProps) {
  const shouldReduceMotion = useReducedMotion();
  const nextLesson = continueLearning[0];

  const actions: QuickAction[] = [
    {
      key: 'continue',
      label: 'Continue Learning',
      icon: PlayCircle,
      to: nextLesson
        ? `/trainee/classroom/${nextLesson.courseId}/lessons/${nextLesson.lessonId}`
        : ROUTES.TRAINEE.CLASSROOM,
    },
    { key: 'ai-tutor', label: 'Ask AI', icon: Sparkles, to: ROUTES.TRAINEE.AI_TUTOR, isAiFlavored: true },
    { key: 'assessments', label: 'View Assessments', icon: ClipboardList, to: ROUTES.TRAINEE.ASSESSMENTS },
    { key: 'progress', label: 'My Progress', icon: BarChart3, to: ROUTES.TRAINEE.MY_PROGRESS },
    { key: 'ask', label: 'Ask a Question', icon: MessageCircleQuestion, to: `${ROUTES.TRAINEE.QNA}/ask` },
  ];

  const containerMotionProps = shouldReduceMotion
    ? {}
    : { initial: 'hidden', animate: 'visible', variants: containerVariants };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const hoverMotionProps = shouldReduceMotion
    ? {}
    : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Quick Actions</h2>
      <motion.div {...containerMotionProps} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <motion.div key={action.key} {...itemMotionProps}>
            <motion.div {...hoverMotionProps} className="h-full">
              <Link
                to={action.to}
                className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm transition-all hover:border-primary hover:bg-accent/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg',
                    action.isAiFlavored
                      ? 'bg-brand-accent/15 text-brand-accent'
                      : 'bg-primary/10 text-primary',
                  )}
                >
                  <action.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-medium leading-tight">{action.label}</span>
              </Link>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export { TraineeQuickActions };
