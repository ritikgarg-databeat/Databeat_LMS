import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Brain, GraduationCap, Sparkles, TrendingUp, Users } from 'lucide-react';

import databeatLogoDark from '@/assets/images/databeat-logo-dark.png';

/** Bar heights (%) for the decorative chart shape — purely illustrative, not real data. */
const CHART_BARS = [42, 68, 54, 85, 63, 91];

const STAT_TILES: Array<{ icon: typeof Users; label: string; value: string; series: number }> = [
  { icon: Users, label: 'Active learners', value: '2,480', series: 1 },
  { icon: TrendingUp, label: 'Completion rate', value: '94%', series: 2 },
  { icon: GraduationCap, label: 'Courses live', value: '312', series: 3 },
];

/**
 * Zero-dependency decorative dashboard mockup — stat tiles + a stylized bar-chart shape,
 * built entirely from styled `div`s using the `--viz-series-*` accent tokens (globals.css).
 * Not a real screenshot; purely a "brand side" visual anchor.
 */
function AuthDashboardMockup() {
  return (
    <div className="relative w-full max-w-sm">
      {/* Back card, slightly rotated, for a stacked-card depth effect. */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm" />

      <div className="relative rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground/90">
            <Brain className="size-4" aria-hidden="true" />
            AI Insights
          </div>
          <Sparkles className="size-4 text-primary-foreground/60" aria-hidden="true" />
        </div>

        {/* Stylized bar chart. */}
        <div className="mb-5 flex h-24 items-end gap-2" role="presentation">
          {CHART_BARS.map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${height}%`,
                backgroundColor: `var(--viz-series-${(index % 8) + 1})`,
                opacity: 0.85,
              }}
            />
          ))}
        </div>

        {/* Stat tiles. */}
        <div className="grid grid-cols-1 gap-2">
          {STAT_TILES.map(({ icon: Icon, label, value, series }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg bg-primary-foreground/10 px-3 py-2">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `var(--viz-series-${series})`, opacity: 0.9 }}
              >
                <Icon className="size-4 text-white" aria-hidden="true" />
              </span>
              <div className="flex flex-1 items-baseline justify-between">
                <span className="text-xs text-primary-foreground/70">{label}</span>
                <span className="text-sm font-semibold text-primary-foreground">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Left-hand brand panel for the split-screen auth layout. Hidden below `lg:` — the login
 * form is the sole focus on mobile/tablet (see layouts/auth-layout.tsx).
 */
function BrandingPanel() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative hidden h-full flex-col justify-between overflow-hidden bg-brand-gradient-animated p-10 text-primary-foreground lg:flex"
    >
      {/* Subtle brand-tinted gradient wash for extra depth over the animated gradient below —
          built from the brand gradient/accent tokens (globals.css), not the --viz-series-*
          chart-series palette (those are reserved for real data visualization, see
          features/analytics/**). */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, color-mix(in oklch, var(--brand-accent) 30%, transparent), transparent 60%), radial-gradient(circle at 80% 80%, color-mix(in oklch, var(--gradient-to) 35%, transparent), transparent 60%)',
        }}
      />

      {/* Always the white-text logo variant, regardless of the app's own light/dark theme
       * toggle — this panel's background is a fixed, always-colorful brand gradient (never a
       * neutral light surface), so the light-text (black) variant would never be legible here. */}
      <div className="relative z-10 flex items-center">
        <img src={databeatLogoDark} alt="Databeat" className="h-10 w-auto" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 py-12">
        <AuthDashboardMockup />
      </div>

      <div className="relative z-10 max-w-md space-y-2">
        <h2 className="flex items-center gap-2 text-2xl font-semibold leading-tight">
          <BarChart3 className="size-6" aria-hidden="true" />
          AI-Powered Learning Platform for Modern Teams
        </h2>
        <p className="text-sm text-primary-foreground/70">
          Track progress, run assessments, and surface insights across every department — all
          from one place.
        </p>
      </div>
    </motion.div>
  );
}

export { BrandingPanel };
