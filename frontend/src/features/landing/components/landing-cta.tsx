import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

/**
 * Closing CTA band — restates the headline and repeats the single "Sign In" CTA before the
 * footer. A small floating icon chip (`.animate-float`, CSS-driven and already
 * reduced-motion-safe via globals.css) adds a bit of ambient life to the gradient band without
 * needing its own Framer entrance — it rides along with the band's own `whileInView` fade since
 * it's a plain DOM descendant. The button uses the `secondary` variant (for contrast against the
 * gradient background) rather than `default`, so it doesn't get the `default` variant's built-in
 * `hover:shadow-glow` / lift — those are added directly here to close the page on the same
 * confident hover treatment used elsewhere on the page (e.g. the hero CTA).
 */
function LandingCta() {
  const shouldReduceMotion = useReducedMotion();
  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.4 },
        transition: { duration: 0.5 },
      };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        {...motionProps}
        className="bg-brand-gradient-animated shadow-glow relative mx-auto max-w-3xl rounded-2xl px-6 py-12 text-center sm:px-12"
      >
        <div
          aria-hidden="true"
          className="animate-float absolute -top-4 -right-4 hidden size-12 items-center justify-center rounded-full bg-card shadow-glow sm:flex"
        >
          <Sparkles className="text-brand-accent size-5" aria-hidden />
        </div>

        <h2 className="text-primary-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Ready to bring AI-powered training to your team?
        </h2>
        <p className="text-primary-foreground/80 mt-3">
          Sign in to launch courses and assessments, backed by an AI tutor that answers every trainee&apos;s
          questions in real time.
        </p>
        <Button
          asChild
          size="lg"
          variant="secondary"
          className="mt-6 transition-all hover:shadow-glow motion-safe:hover:-translate-y-px"
        >
          <Link to={ROUTES.LOGIN}>Sign In</Link>
        </Button>
      </motion.div>
    </section>
  );
}

export { LandingCta };
