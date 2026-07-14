import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Download } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface Stat {
  value: string;
  label: string;
}

/** Illustrative marketing figures — not live data. */
const STATS: Stat[] = [
  { value: '94%', label: 'Completion Rate' },
  { value: '12.4K', label: 'Lessons Completed' },
  { value: '3,200+', label: 'Active Learners' },
  { value: '4.8/5', label: 'Trainer Rating' },
];

/** Decorative bar heights for the mockup chart — purely illustrative, no real data source. */
const CHART_BARS = [35, 55, 45, 70, 60, 85, 65, 90, 75, 95];

/**
 * The platform's real, downloadable CSV reports (trainer/admin-facing). Named explicitly in the
 * copy above the illustrative mockup so this section grounds itself in an actual feature, not
 * just marketing stats.
 */
const CSV_REPORTS = ['User Progress', 'Assessment Results', 'Group Performance', 'Course Completion'];

const statContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const statItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/**
 * Analytics section. Copy names the platform's real reporting features — a live trainee
 * leaderboard and four downloadable CSV reports — above an illustrative dashboard mockup (stat
 * tiles + a CSS bar chart, no chart library, no live data). The stat tiles stagger in individually
 * via declared container/item variants; the chart bars grow from zero with a per-bar delay,
 * mirroring the hero mockup's bar animation but gated on `whileInView` since this section sits
 * below the fold.
 */
function LandingAnalyticsSection() {
  const shouldReduceMotion = useReducedMotion();

  const statContainerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true, amount: 0.3 },
        variants: statContainerVariants,
      };
  const statItemMotionProps = shouldReduceMotion ? {} : { variants: statItemVariants };

  const barMotionProps = (index: number) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { scaleY: 0 },
          whileInView: { scaleY: 1 },
          viewport: { once: true, amount: 0.4 },
          transition: { duration: 0.5, ease: 'easeOut' as const, delay: index * 0.05 },
        };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            See progress at a glance
          </h2>
          <p className="mt-3 text-muted-foreground">
            Dashboards built for trainers and admins to spot trends and act on them.
          </p>
          <p className="mt-2 text-muted-foreground">
            See who&apos;s leading on a live trainee leaderboard, then export the numbers as CSV
            reports:
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {CSV_REPORTS.map((report) => (
              <Badge key={report} variant="outline" className="gap-1.5">
                <Download className="size-3" aria-hidden />
                {report}
              </Badge>
            ))}
          </div>
        </div>

        <Card className="mt-12 p-6 sm:p-8">
          <motion.div {...statContainerMotionProps} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((stat) => (
              <motion.div
                key={stat.label}
                {...statItemMotionProps}
                className="rounded-lg bg-muted p-4 text-center sm:text-left"
              >
                <p className="text-2xl font-semibold text-[var(--viz-series-1)] sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-8 flex h-32 items-end gap-2 sm:gap-3" aria-hidden="true">
            {CHART_BARS.map((height, index) => (
              <motion.div
                key={index}
                className="flex-1 rounded-t-md bg-[var(--viz-series-1)]"
                style={{
                  height: `${height}%`,
                  opacity: 0.5 + (index / CHART_BARS.length) * 0.5,
                  transformOrigin: 'bottom',
                }}
                {...barMotionProps(index)}
              />
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

export { LandingAnalyticsSection };
