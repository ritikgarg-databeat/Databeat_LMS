import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Megaphone,
  MessagesSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: BookOpen,
    title: 'Course Authoring',
    description:
      'Structure courses into modules and lessons, then attach real material: PDF, PPTX, DOCX, video, images, or pasted Markdown.',
  },
  {
    icon: Sparkles,
    title: 'AI Completion Quizzes',
    description:
      'Marking a lesson complete triggers a 4-5 question quiz the AI writes from its actual material, so completion means something.',
  },
  {
    icon: ClipboardCheck,
    title: 'Assessments & Question Bank',
    description:
      '9 question types across Python, SQL, Statistics, ML, Power BI, Excel, Spark, and Hadoop, at 3 difficulty levels, auto- and manually graded.',
  },
  {
    icon: Bot,
    title: 'Contextual AI Tutor',
    description:
      'Trainees ask the AI about the exact lesson they are viewing and resume that conversation later, not a generic chatbot.',
  },
  {
    icon: BarChart3,
    title: 'Analytics, Leaderboards & Reports',
    description:
      'See completion, scores, and engagement by trainee or group, then export CSV reports for progress, results, and completion.',
  },
  {
    icon: MessagesSquare,
    title: 'Q&A Collaboration',
    description:
      'Threaded, searchable, taggable lesson discussions where upvotes and a verified-answer badge surface the best response.',
  },
  {
    icon: Users,
    title: 'Groups & Bulk Onboarding',
    description:
      'Organize trainees by department, assign a trainer per group, and import a whole roster from one CSV instead of one at a time.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar & Scheduling',
    description: 'A shared calendar keeps upcoming sessions and deadlines visible to trainers and trainees alike.',
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    description: 'Trainers push announcements straight to every trainee dashboard the moment they matter.',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
};

/**
 * Nine-card feature grid — the "everything this platform does" showcase. Header fades up
 * independently of the grid; the grid itself is parent-driven staggered fade/scale-in on scroll.
 * Each card lifts on hover (Framer `whileHover`) while a CSS `group` pairing scales the icon chip
 * and sweeps in a tinted top accent bar — all gated behind `useReducedMotion()`/`motion-safe:` so
 * reduced-motion users still get the static end state without the movement.
 */
function LandingFeatures() {
  const shouldReduceMotion = useReducedMotion();

  const headerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.6 },
        transition: { duration: 0.5, ease: 'easeOut' as const },
      };
  const containerMotionProps = shouldReduceMotion
    ? {}
    : { initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0.2 }, variants: containerVariants };
  const itemMotionProps = shouldReduceMotion ? {} : { variants: itemVariants };
  const hoverMotionProps = shouldReduceMotion
    ? {}
    : { whileHover: { y: -6, transition: { duration: 0.2, ease: 'easeOut' as const } } };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div {...headerMotionProps} className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="gap-1.5 py-1.5">
            <Sparkles className="size-3.5" aria-hidden />
            9 Core Capabilities
          </Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Every step of training, in one platform
          </h2>
          <p className="mt-3 text-muted-foreground">
            From authoring real course material to AI-graded quizzes, formal assessments, and analytics that
            prove who actually learned.
          </p>
        </motion.div>

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
              <motion.div key={feature.title} className="group" {...itemMotionProps} {...hoverMotionProps}>
                {/* hover:shadow-glow alone, not layered with hover:shadow-lg — Tailwind v4
                 * auto-generates a --tw-shadow-composed utility for `shadow-glow` (it's a
                 * `@theme inline` token), and its cascade position loses to the built-in
                 * hover:shadow-lg, silently no-op'ing the brand glow if both are present. */}
                <Card className="relative h-full overflow-hidden transition-shadow hover:shadow-glow">
                  {/* Tinted top accent bar — hidden by default (scaled to zero width from the left
                   * edge), sweeps in on hover. transition-all avoids stacking two transition-*
                   * utilities on one element, which is the same "last one wins" Tailwind v4 cascade
                   * quirk noted above for shadow-glow. */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 motion-safe:group-hover:scale-x-100',
                      isAccent ? 'bg-brand-accent' : 'bg-primary',
                    )}
                  />
                  <CardHeader>
                    <div
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg transition-all duration-300 motion-safe:group-hover:scale-110',
                        isAccent
                          ? 'bg-brand-accent/15 group-hover:bg-brand-accent/25'
                          : 'bg-primary/10 group-hover:bg-primary/20',
                      )}
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
