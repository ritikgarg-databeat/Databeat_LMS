import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

/** Decorative bar heights for the mini chart inside the hero mockup — purely illustrative. */
const MOCKUP_CHART_BARS = [40, 65, 50, 80, 60, 95, 75];

/**
 * Full-width hero for the public landing page. Copy + single "Sign In" CTA on the left, a
 * static (non-interactive) dashboard mockup on the right — built from `Card`/`Badge` primitives
 * and CSS shapes only, no real data or chart library.
 */
function LandingHero() {
  const shouldReduceMotion = useReducedMotion();
  const mockupMotionProps = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.6, ease: 'easeOut' as const } };

  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-16 sm:px-6 sm:pt-24 sm:pb-24 lg:px-8">
      {/* Soft ambient brand-gradient glow, confined to the mockup side so it adds atmosphere
       * without dropping contrast behind the body copy. Pure CSS — already reduced-motion-safe
       * via globals.css's own media query wrapper. */}
      <div
        aria-hidden="true"
        className="bg-brand-gradient-animated pointer-events-none absolute top-1/2 right-[-10%] -z-10 h-[26rem] w-[26rem] -translate-y-1/2 rounded-full opacity-25 blur-3xl sm:h-[34rem] sm:w-[34rem] lg:opacity-30"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-6 text-left">
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <Sparkles className="size-3.5" aria-hidden />
            AI-Powered Learning Platform
          </Badge>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            AI-Powered Learning Platform{' '}
            <span className="text-brand-gradient">for Modern Teams</span>
          </h1>

          <p className="max-w-md text-lg text-muted-foreground">
            Learn, practice, assess, and improve with intelligent training powered by AI.
          </p>

          <Button asChild size="lg">
            <Link to={ROUTES.LOGIN}>Sign In</Link>
          </Button>
        </div>

        <motion.div
          {...mockupMotionProps}
          className="relative mx-auto w-full max-w-md pb-6 lg:max-w-none"
          aria-hidden="true"
        >
          {/* shadow-glow alone, not paired with shadow-xl — verified via computed styles that
           * the hand-written .shadow-glow override in globals.css always wins the box-shadow
           * property over any other static Tailwind shadow-* utility on the same element, so
           * keeping shadow-xl alongside it would be dead weight (see the hover-state version of
           * this same Tailwind v4 cascade quirk noted in landing-features.tsx). */}
          <Card className="relative z-10 -rotate-1 p-5 shadow-glow sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Data Analysis Fundamentals</p>
              <Badge variant="secondary">72%</Badge>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted">
              <div className="h-2 rounded-full bg-[var(--viz-series-1)]" style={{ width: '72%' }} />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Courses</p>
                <p className="text-lg font-semibold">12</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="text-lg font-semibold">94%</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">Learners</p>
                <p className="text-lg font-semibold">3.2k</p>
              </div>
            </div>

            <div className="mt-5 flex h-16 items-end gap-1.5">
              {MOCKUP_CHART_BARS.map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-sm bg-[var(--viz-series-1)]/70"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </Card>

          <Card className="absolute -bottom-2 -left-4 z-0 hidden w-36 rotate-3 p-3 shadow-lg sm:block">
            <p className="text-xs text-muted-foreground">Weekly progress</p>
            <p className="text-brand-accent text-2xl font-semibold">+18%</p>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

export { LandingHero };
