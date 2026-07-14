import { motion, useReducedMotion } from 'framer-motion';

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
    title: 'Trainees learn with AI assistance',
    description: 'Learners work through lessons with an AI assistant on hand to explain anything.',
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

/** Four-step timeline, numbered and connected by a subtle line, staggered in on scroll by index. */
function LandingHowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-muted-foreground">From setup to insight in four straightforward steps.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, amount: 0.3 },
                    transition: { duration: 0.4, delay: index * 0.15 },
                  })}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
                  {index + 1}
                </div>
                {index < STEPS.length - 1 ? (
                  <div className="bg-primary/25 hidden h-px flex-1 lg:block" aria-hidden="true" />
                ) : null}
              </div>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { LandingHowItWorks };
