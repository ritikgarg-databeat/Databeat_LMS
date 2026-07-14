import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BarChart3, BookOpen, ClipboardCheck, MessagesSquare, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: Sparkles,
    title: 'AI Learning Assistant',
    description: 'Ask questions about any lesson and get instant, contextual explanations powered by AI.',
  },
  {
    icon: BookOpen,
    title: 'Structured Courses',
    description: 'Organize training into clear learning paths with lessons, modules, and milestones.',
  },
  {
    icon: ClipboardCheck,
    title: 'Smart Assessments',
    description: 'Auto-graded quizzes and assignments that measure real understanding, not just completion.',
  },
  {
    icon: BarChart3,
    title: 'Progress Analytics',
    description: 'Track completion, scores, and engagement trends across every trainee and team.',
  },
  {
    icon: Users,
    title: 'Trainer Management',
    description: 'Give trainers the tools to manage groups, departments, and classrooms with ease.',
  },
  {
    icon: MessagesSquare,
    title: 'Collaborative Q&A',
    description: 'Trainees and trainers discuss lessons together in threaded, searchable Q&A.',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/** Six-card feature grid — parent-driven staggered fade-in on scroll, lift-on-hover per card. */
function LandingFeatures() {
  const shouldReduceMotion = useReducedMotion();
  const containerMotionProps = shouldReduceMotion
    ? {}
    : { initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0.2 }, variants: containerVariants };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const hoverMotionProps = shouldReduceMotion ? {} : { whileHover: { y: -4 } };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a training team needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            One platform to build, deliver, and measure learning — with AI built in from day one.
          </p>
        </div>

        <motion.div
          {...containerMotionProps}
          className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature, index) => {
            /* Alternate between the two brand hues (rather than the 8-color chart palette) so the
             * grid reads as curated, not a rainbow — every icon still traces back to primary or
             * brand-accent, the same two tokens used everywhere else on the page. */
            const isAccent = index % 2 === 1;
            return (
              <motion.div key={feature.title} {...itemMotionProps} {...hoverMotionProps}>
                {/* hover:shadow-glow alone, not layered with hover:shadow-lg — Tailwind v4
                 * auto-generates a --tw-shadow-composed utility for `shadow-glow` (it's a
                 * `@theme inline` token), and its cascade position loses to the built-in
                 * hover:shadow-lg, silently no-op'ing the brand glow if both are present. */}
                <Card className="h-full transition-shadow hover:shadow-glow">
                  <CardHeader>
                    <div
                      className={
                        isAccent
                          ? 'bg-brand-accent/15 flex size-10 items-center justify-center rounded-lg'
                          : 'flex size-10 items-center justify-center rounded-lg bg-primary/10'
                      }
                    >
                      <feature.icon
                        className={isAccent ? 'text-brand-accent size-5' : 'size-5 text-primary'}
                        aria-hidden
                      />
                    </div>
                    <CardTitle className="mt-3 text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

export { LandingFeatures };
