import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Award, Clock, Flame, Layers, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

import { BrandLogo } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

/** A resting "lub-dub, pause" heartbeat cadence (not a smooth sine pulse) — two quick beats of
 * different strength, then a hold before the cycle repeats, matching a real heartbeat's rhythm
 * rather than generic ambient pulsing. Shared by the logo's scale and its glow's opacity so both
 * beat in sync. */
const HEARTBEAT_TIMES = [0, 0.08, 0.16, 0.24, 0.32, 1];
const HEARTBEAT_DURATION = 2.4;

/** Decorative bar heights for the mini chart inside the hero mockup — purely illustrative. */
const MOCKUP_CHART_BARS = [40, 65, 50, 80, 60, 95, 75];
/** Tiny sparkline inside the "Weekly progress" floating card — purely illustrative. */
const SPARKLINE_BARS = [30, 45, 35, 60, 50, 75, 90];

/** Circumference of the certificate ring (r=16 → 2πr ≈ 100.5), used as both ends of the
 * stroke-dashoffset animation below. */
const RING_CIRCUMFERENCE = 100.5;

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

/**
 * Full-width hero for the public landing page — the first thing every visitor sees, so this is
 * the most animated section on the page. Copy + single "Sign In" CTA on the left (staggers in on
 * mount — above the fold, so `animate`, not `whileInView`); a "live" LMS dashboard mockup on the
 * right, built entirely from `Card`/`Badge` primitives and CSS/SVG shapes (no real data, no chart
 * library) — a central course-progress card (with the Databeat brand mark "beating" in a real
 * heartbeat cadence at its top, see `HEARTBEAT_TIMES`) plus four small floating cards
 * (weekly-progress sparkline, an AI-quiz badge, a certificate/completion ring, and a
 * learning-streak badge), each drifting independently via the `animate-float`/`-delayed`/`-slow`
 * CSS utilities (globals.css) so the whole mockup reads as alive rather than a static screenshot.
 */
function LandingHero() {
  const shouldReduceMotion = useReducedMotion();

  const containerMotionProps = shouldReduceMotion
    ? {}
    : { initial: 'hidden', animate: 'visible', variants: containerVariants };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const mockupMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.94, y: 12 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.6, ease: 'easeOut' as const, delay: 0.15 },
      };
  // Bundles the target height INTO the returned `style` object (rather than leaving callers to
  // pass their own separate `style={{height}}` prop alongside this) — JSX prop spread doesn't
  // deep-merge, so a caller-supplied `style` prop written before `{...barMotionProps(...)}` would
  // be silently clobbered by this function's own `style: {transformOrigin}`, collapsing every bar
  // to ~0 height. Confirmed empirically via a live DOM inspection (computed height ~1px on every
  // bar) after this exact bug shipped once already in this file.
  const barMotionProps = (height: number, index: number, baseDelay = 0.9) =>
    shouldReduceMotion
      ? { style: { height: `${height}%` } }
      : {
          initial: { scaleY: 0 },
          animate: { scaleY: 1 },
          transition: { duration: 0.5, ease: 'easeOut' as const, delay: baseDelay + index * 0.05 },
          style: { height: `${height}%`, transformOrigin: 'bottom' as const },
        };
  const progressMotionProps = shouldReduceMotion
    ? { style: { width: '72%' } }
    : {
        initial: { width: '0%' },
        animate: { width: '72%' },
        transition: { duration: 1, ease: 'easeOut' as const, delay: 0.65 },
      };
  const ringMotionProps = shouldReduceMotion
    ? { style: { strokeDashoffset: RING_CIRCUMFERENCE * 0.05 } }
    : {
        initial: { strokeDashoffset: RING_CIRCUMFERENCE },
        animate: { strokeDashoffset: RING_CIRCUMFERENCE * 0.05 },
        transition: { duration: 1.1, ease: 'easeOut' as const, delay: 1.1 },
      };
  const floatCardMotionProps = (delay: number) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, scale: 0.8 },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: 0.4, ease: 'easeOut' as const, delay },
        };
  const heartbeatLogoMotionProps = shouldReduceMotion
    ? {}
    : {
        animate: { scale: [1, 1.18, 1, 1.1, 1, 1] },
        transition: {
          duration: HEARTBEAT_DURATION,
          times: HEARTBEAT_TIMES,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      };
  const heartbeatGlowMotionProps = shouldReduceMotion
    ? {}
    : {
        animate: { opacity: [0.15, 0.55, 0.15, 0.4, 0.15, 0.15] },
        transition: {
          duration: HEARTBEAT_DURATION,
          times: HEARTBEAT_TIMES,
          repeat: Infinity,
          ease: 'easeInOut' as const,
        },
      };

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
        <motion.div {...containerMotionProps} className="flex flex-col items-start gap-6 text-left">
          <motion.div {...itemMotionProps}>
            <Badge variant="outline" className="gap-1.5 py-1.5">
              <Sparkles className="size-3.5" aria-hidden />
              AI-Powered Learning Platform
            </Badge>
          </motion.div>

          <motion.h1
            {...itemMotionProps}
            className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            AI-Powered Learning Platform{' '}
            <span className="text-brand-gradient">for Modern Teams at Databeat</span>
          </motion.h1>

          <motion.p {...itemMotionProps} className="max-w-md text-lg text-muted-foreground">
            Build courses, run assessments, and let AI generate a quick check on every lesson — with real
            analytics on who&rsquo;s actually learning.
          </motion.p>

          <motion.div {...itemMotionProps}>
            <Button asChild size="lg" className="motion-safe:hover:scale-[1.02]">
              <Link to={ROUTES.LOGIN}>Sign In</Link>
            </Button>
          </motion.div>
        </motion.div>

        <motion.div
          {...mockupMotionProps}
          className="relative mx-auto w-full max-w-md pt-10 pb-20 lg:max-w-none lg:pt-12"
          aria-hidden="true"
        >
          {/* shadow-glow alone, not paired with shadow-xl — verified via computed styles that
           * the hand-written .shadow-glow override in globals.css always wins the box-shadow
           * property over any other static Tailwind shadow-* utility on the same element, so
           * keeping shadow-xl alongside it would be dead weight (see the hover-state version of
           * this same Tailwind v4 cascade quirk noted in landing-features.tsx). */}
          <Card className="relative z-10 -rotate-1 p-5 shadow-glow sm:p-6">
            {/* The brand mark "beats" here — a real heartbeat cadence (two quick pulses, then a
             * rest), not a smooth ambient glow — standing in for the platform's own live pulse of
             * learning activity. A soft blurred halo behind the logo pulses in sync (same
             * keyframe/times), gated behind `useReducedMotion()` like everything else on this page. */}
            <div className="relative mb-4 inline-flex items-center">
              <motion.div
                aria-hidden="true"
                className="bg-primary absolute -inset-3 -z-10 rounded-full blur-lg"
                {...heartbeatGlowMotionProps}
              />
              <motion.div {...heartbeatLogoMotionProps}>
                <BrandLogo imgClassName="h-4" />
              </motion.div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Data Analysis Fundamentals</p>
              <Badge variant="secondary">72%</Badge>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div className="h-2 rounded-full bg-[var(--viz-series-1)]" {...progressMotionProps} />
            </div>

            {/* Course-specific stats — not platform-wide aggregates. A single-course progress
             * card showing "12 courses" / "3.2k learners" (org-wide numbers) never made sense
             * next to a 72%-complete course; these three are all about *this* course instead. */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <Layers className="size-3.5 text-muted-foreground" aria-hidden />
                <p className="mt-1 text-xs text-muted-foreground">Modules</p>
                <p className="text-lg font-semibold">5/7</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <Target className="size-3.5 text-muted-foreground" aria-hidden />
                <p className="mt-1 text-xs text-muted-foreground">Quiz Avg</p>
                <p className="text-lg font-semibold">92%</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <Clock className="size-3.5 text-muted-foreground" aria-hidden />
                <p className="mt-1 text-xs text-muted-foreground">Time Spent</p>
                <p className="text-lg font-semibold">3.2h</p>
              </div>
            </div>

            <div className="mt-5 flex h-16 items-end gap-1.5">
              {MOCKUP_CHART_BARS.map((height, index) => (
                <motion.div
                  key={index}
                  className="flex-1 rounded-t-sm bg-[var(--viz-series-1)]/70"
                  {...barMotionProps(height, index)}
                />
              ))}
            </div>
          </Card>

          {/* Four floating accent cards, one per corner, each on its own float timing
           * (float / -delayed / -slow) so nothing drifts in lockstep. */}

          <motion.div
            {...floatCardMotionProps(0.5)}
            className="animate-float-slow absolute -top-8 -left-4 z-20 hidden sm:block"
          >
            <Card className="w-40 -rotate-2 p-3 shadow-lg">
              <div className="flex items-center gap-2.5">
                <div className="relative size-9 shrink-0">
                  <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="var(--muted)" strokeWidth="3" />
                    <motion.circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE}
                      {...ringMotionProps}
                    />
                  </svg>
                  <Award className="absolute inset-0 m-auto size-4 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Certificate earned</p>
                  <p className="truncate text-sm font-semibold">SQL Fundamentals</p>
                </div>
              </div>
            </Card>
          </motion.div>

          <Badge
            variant="secondary"
            dot
            className="animate-float-delayed absolute top-2 -right-3 z-20 hidden gap-1.5 bg-card py-1.5 shadow-lg sm:flex"
          >
            <Sparkles className="size-3 text-primary" aria-hidden />
            Quiz generated
          </Badge>

          <motion.div
            {...floatCardMotionProps(0.8)}
            className="animate-float absolute -bottom-10 -left-8 z-20 hidden sm:block"
          >
            <Card className="w-36 rotate-3 p-3 shadow-lg">
              <p className="text-xs text-muted-foreground">Weekly progress</p>
              <p className="text-brand-accent text-2xl font-semibold">+18%</p>
              <div className="mt-2 flex h-6 items-end gap-1">
                {SPARKLINE_BARS.map((height, index) => (
                  <motion.div
                    key={index}
                    className="bg-brand-accent/60 flex-1 rounded-t-sm"
                    {...barMotionProps(height, index, 1.3)}
                  />
                ))}
              </div>
            </Card>
          </motion.div>

          <Badge
            variant="secondary"
            className="animate-float-slow absolute -right-4 -bottom-6 z-20 hidden gap-1.5 bg-card py-1.5 shadow-lg sm:flex"
          >
            <Flame className="text-brand-accent size-3" aria-hidden />
            7-day streak
          </Badge>
        </motion.div>
      </div>
    </section>
  );
}

export { LandingHero };
