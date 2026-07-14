import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BookPlus, ClipboardCheck, FileDown, Megaphone, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/constants/routes';

export interface TrainerQuickActionsProps {
  /** Already-fetched from `TrainerDashboard.pendingGradingCount` — badges the Grade Assessments action. */
  pendingGradingCount: number;
}

interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  to: string;
  badgeCount?: number;
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
 * Trainer dashboard shortcut row (Prompt 9 § Part A) — purely navigational, no data of its own
 * beyond `pendingGradingCount` (used only to badge the Grade Assessments shortcut).
 */
function TrainerQuickActions({ pendingGradingCount }: TrainerQuickActionsProps) {
  const shouldReduceMotion = useReducedMotion();

  const actions: QuickAction[] = [
    { key: 'create-course', label: 'Create Course', icon: BookPlus, to: ROUTES.TRAINER.CLASSROOM },
    {
      key: 'grade',
      label: 'Grade Assessments',
      icon: ClipboardCheck,
      to: ROUTES.TRAINER.ASSESSMENTS,
      badgeCount: pendingGradingCount,
    },
    { key: 'reports', label: 'View Reports', icon: FileDown, to: ROUTES.TRAINER.REPORTS },
    { key: 'groups', label: 'Manage Groups', icon: Users, to: ROUTES.TRAINER.GROUPS },
    { key: 'announcement', label: 'New Announcement', icon: Megaphone, to: `${ROUTES.TRAINER.ROOT}/notifications` },
  ];

  const containerMotionProps = shouldReduceMotion
    ? {}
    : { initial: 'hidden', animate: 'visible', variants: containerVariants };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const hoverMotionProps = shouldReduceMotion ? {} : { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Quick Actions</h2>
      <motion.div {...containerMotionProps} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => (
          <motion.div key={action.key} {...itemMotionProps}>
            <motion.div {...hoverMotionProps} className="h-full">
              <Link
                to={action.to}
                className="relative flex h-full flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm transition-all hover:border-primary hover:bg-accent/50 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {action.badgeCount ? (
                  <Badge variant="warning" className="absolute right-2 top-2">
                    {action.badgeCount}
                  </Badge>
                ) : null}
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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

export { TrainerQuickActions };
