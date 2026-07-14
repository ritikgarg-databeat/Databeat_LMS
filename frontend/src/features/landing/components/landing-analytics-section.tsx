import { motion, useReducedMotion } from 'framer-motion';

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

/** Static, decorative analytics-dashboard mockup: stat tiles + a CSS bar chart, no chart library. */
function LandingAnalyticsSection() {
  const shouldReduceMotion = useReducedMotion();
  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.5 },
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
        </div>

        <motion.div {...motionProps} className="mt-12">
          <Card className="p-6 sm:p-8">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="rounded-lg bg-muted p-4 text-center sm:text-left">
                  <p className="text-2xl font-semibold text-[var(--viz-series-1)] sm:text-3xl">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex h-32 items-end gap-2 sm:gap-3" aria-hidden="true">
              {CHART_BARS.map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-md bg-[var(--viz-series-1)]"
                  style={{ height: `${height}%`, opacity: 0.5 + (index / CHART_BARS.length) * 0.5 }}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

export { LandingAnalyticsSection };
