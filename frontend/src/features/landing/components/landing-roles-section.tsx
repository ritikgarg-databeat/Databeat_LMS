import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { BookOpen, CheckCircle2, GraduationCap, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RoleProfile {
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
}

/**
 * Ordered admin -> trainer -> trainee so the grid (and the mobile single-column stack) reads
 * top-down like an org chart, then the staggered entrance below reinforces that same order.
 */
const ROLES: RoleProfile[] = [
  {
    icon: ShieldCheck,
    title: 'Super Admin',
    tagline: 'Org-wide control',
    description: 'One seat over the whole organization — people, programs, and performance.',
    bullets: [
      'Manage trainer accounts, departments & groups org-wide',
      'Platform-wide analytics across every course & assessment',
      'Full visibility into trainer and trainee activity',
      'Configure platform settings & access',
    ],
  },
  {
    icon: GraduationCap,
    title: 'Trainer',
    tagline: 'Content & people',
    description: 'Build the curriculum, run the classroom, and prove the results.',
    bullets: [
      'Author courses — modules, lessons, PDFs, slides, video',
      'Build assessments & manage the shared question bank',
      'Group trainees, bulk-import rosters via CSV, track leaderboards',
      'Grade submissions & export progress, results, completion reports',
    ],
  },
  {
    icon: BookOpen,
    title: 'Trainee',
    tagline: 'Learning experience',
    description: 'Learn at your own pace, with an AI tutor and real feedback along the way.',
    bullets: [
      'Work through courses with an AI tutor on every lesson',
      'Quick AI-generated check before marking a lesson done',
      'Take timed assessments and see results instantly',
      'Ask the Q&A forum & track your leaderboard rank',
    ],
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/**
 * Three-persona breakdown (Super Admin / Trainer / Trainee) — the section that grounds the product
 * in real day-to-day usage instead of abstract feature claims. Cards stagger left-to-right (and
 * stack top-to-bottom on mobile) in the same admin -> trainer -> trainee order, so the reveal
 * itself reads like an org chart. Each card gets a thin top border in its assigned accent so the
 * three feel like distinct personas rather than identical boxes with swapped copy.
 */
function LandingRolesSection() {
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
  const hoverMotionProps = shouldReduceMotion ? {} : { whileHover: { y: -4 } };

  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built for every role</h2>
          <p className="mt-3 text-muted-foreground">
            Super Admins, Trainers, and Trainees each get a workspace shaped around what they actually do —
            not one dashboard trying to be everything.
          </p>
        </div>

        <motion.div {...containerMotionProps} className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {ROLES.map((role, index) => {
            /* Alternate between the two brand hues (same tokens used across the rest of the
             * landing page) so each persona reads as distinct without inventing a third color. */
            const isAccent = index % 2 === 1;
            return (
              <motion.div key={role.title} {...itemMotionProps} {...hoverMotionProps}>
                <Card
                  className={cn(
                    'h-full border-t-4 transition-shadow hover:shadow-glow',
                    isAccent ? 'border-t-brand-accent' : 'border-t-primary',
                  )}
                >
                  <CardHeader>
                    <div
                      className={cn(
                        'flex size-12 items-center justify-center rounded-xl',
                        isAccent ? 'bg-brand-accent/15' : 'bg-primary/10',
                      )}
                    >
                      <role.icon
                        className={cn('size-6', isAccent ? 'text-brand-accent' : 'text-primary')}
                        aria-hidden
                      />
                    </div>
                    <CardTitle className="mt-4 text-xl">{role.title}</CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        'w-fit',
                        isAccent
                          ? 'border-brand-accent/30 text-brand-accent'
                          : 'border-primary/30 text-primary',
                      )}
                    >
                      {role.tagline}
                    </Badge>
                    <CardDescription className="mt-2">{role.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2.5">
                      {role.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2 text-sm">
                          <CheckCircle2
                            className={cn(
                              'mt-0.5 size-4 shrink-0',
                              isAccent ? 'text-brand-accent' : 'text-primary',
                            )}
                            aria-hidden
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
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

export { LandingRolesSection };
