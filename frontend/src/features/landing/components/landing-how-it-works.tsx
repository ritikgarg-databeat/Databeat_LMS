import { motion, useReducedMotion, type Variants } from 'framer-motion';

interface Step {
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    title: 'Trainer creates learning paths',
    description: 'Build structured courses, lessons, and milestones tailored to each team.',
  },
  {
    title: 'Trainees learn with an AI check-in',
    description:
      "Marking a lesson complete triggers a short AI-generated quiz built from that lesson's own content — a genuine check of engagement, not just a checkbox click.",
  },
  {
    title: 'Assessments measure growth',
    description: 'Auto-graded quizzes and assignments show what has actually been learned.',
  },
  {
    title: 'Analytics improve performance',
    description: 'Trends and insights help trainers close gaps and raise outcomes over time.',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Connecting line "draws in" left-to-right right after its step's own fade-in fires — the small
// extra delay reads as the line catching up to the step that just landed, not appearing at once.
const lineVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.5, ease: 'easeOut', delay: 0.2 } },
};

/** Four-step timeline, numbered and connected by a line that draws in as each step stagger-reveals on scroll. */
function LandingHowItWorks() {
  const shouldReduceMotion = useReducedMotion();
  const containerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true, amount: 0.2 },
        variants: containerVariants,
      };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const lineMotionProps = shouldReduceMotion ? {} : { variants: lineVariants };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">From setup to insight in four straightforward steps.</p>
        </div>

        <motion.div
          {...containerMotionProps}
          className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        >
          {STEPS.map((step, index) => (
            <motion.div key={step.title} {...itemMotionProps} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                  {index + 1}
                </div>
                {index < STEPS.length - 1 ? (
                  <motion.div
                    {...lineMotionProps}
                    style={{ transformOrigin: 'left' }}
                    className="bg-primary/25 hidden h-px flex-1 lg:block"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export { LandingHowItWorks };
