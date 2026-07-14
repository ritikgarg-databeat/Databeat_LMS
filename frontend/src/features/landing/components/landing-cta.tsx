import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

/** Closing CTA band — restates the headline and repeats the single "Sign In" CTA before the footer. */
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
        className="bg-brand-gradient-animated shadow-glow mx-auto max-w-3xl rounded-2xl px-6 py-12 text-center sm:px-12"
      >
        <h2 className="text-primary-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
          Ready to bring AI-powered training to your team?
        </h2>
        <p className="text-primary-foreground/80 mt-3">
          Sign in to explore courses, assessments, and analytics built for modern learning teams.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-6">
          <Link to={ROUTES.LOGIN}>Sign In</Link>
        </Button>
      </motion.div>
    </section>
  );
}

export { LandingCta };
