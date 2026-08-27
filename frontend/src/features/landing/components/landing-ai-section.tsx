import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { History, ListChecks, MessageCircleQuestion, Sparkles, Target, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface Capability {
  icon: LucideIcon;
  label: string;
}

const CAPABILITIES: Capability[] = [
  { icon: MessageCircleQuestion, label: 'Ask AI about the exact lesson you are on' },
  { icon: Wand2, label: 'Get instant, plain-language explanations' },
  { icon: History, label: 'Resume saved conversations anytime' },
  { icon: ListChecks, label: 'AI quiz confirms the lesson sank in' },
  { icon: Target, label: 'Personalized recommendations as you progress' },
];

const chatContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.5, delayChildren: 0.2 } },
};

const bubbleVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// Opacity keyframes so the three dots pulse in, hold briefly, then fade out right as the AI
// bubble (the next staggered child) lands — a quick "thinking" beat, not a slow demo.
const typingVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: [0, 1, 1, 0],
    transition: { duration: 0.7, times: [0, 0.2, 0.75, 1], ease: 'easeInOut' },
  },
};

/**
 * "The AI part" of the landing page — a tinted panel pairing the five AI capabilities with a
 * static chat-bubble mockup (canned copy, no real AI call) to visually set the section apart.
 */
function LandingAiSection() {
  const shouldReduceMotion = useReducedMotion();
  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.5 },
      };
  // Independent, slightly-delayed nested trigger: the bubbles sequence in a beat after the
  // outer two-column grid above starts its own fade-in, rather than popping in all at once.
  const chatContainerMotionProps = shouldReduceMotion
    ? {}
    : {
        initial: 'hidden',
        whileInView: 'visible',
        viewport: { once: true, amount: 0.5 },
        variants: chatContainerVariants,
      };
  const bubbleMotionProps = shouldReduceMotion ? {} : { variants: bubbleVariants };

  return (
    <section className="bg-muted/40 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div
          {...motionProps}
          className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16"
        >
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Learning, with AI built in</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Every lesson has an AI tutor grounded in the exact lesson you are viewing — not a generic
              chatbot — and it keeps your conversation saved so you can resume it later. Try to mark a lesson
              complete and it also generates a short quiz from the lesson content itself, a real check that
              you engaged with the material.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {CAPABILITIES.map((capability) => (
                <li key={capability.label} className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <capability.icon className="size-4 text-primary" aria-hidden />
                  </div>
                  <span className="text-sm font-medium">{capability.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Chat mockup gets the most deliberate gradient/glow treatment on the page — this is
           * the AI capability, so a futuristic glow reads as intentional rather than noisy. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              aria-hidden="true"
              className="bg-brand-gradient-animated pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-30 blur-2xl"
            />
            <Card className="w-full p-4 shadow-glow sm:p-5" aria-hidden="true">
              <motion.div {...chatContainerMotionProps} className="flex flex-col gap-3">
                <motion.div {...bubbleMotionProps} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                    Can you explain the JOIN example from this lesson?
                  </div>
                </motion.div>

                {/* Brief "thinking" beat between the two bubbles — skipped entirely under
                 * reduced motion rather than left static, since a permanently-visible ellipsis
                 * next to a finished reply would read as broken, not decorative. */}
                {!shouldReduceMotion ? (
                  <motion.div
                    variants={typingVariants}
                    className="flex items-center gap-2"
                    aria-hidden="true"
                  >
                    <div className="bg-brand-gradient flex size-7 shrink-0 items-center justify-center rounded-full">
                      <Sparkles className="size-3.5 text-primary-foreground" aria-hidden />
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="size-1.5 rounded-full bg-muted-foreground/60"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            delay: dot * 0.15,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : null}

                <motion.div {...bubbleMotionProps} className="flex items-start gap-2">
                  <div className="bg-brand-gradient flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Sparkles className="size-3.5 text-primary-foreground" aria-hidden />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2 text-sm text-card-foreground">
                    In the example from this lesson, an INNER join keeps only matching rows between the two
                    tables, while a LEFT join also keeps every row from the first table even without a match.
                  </div>
                </motion.div>
              </motion.div>
            </Card>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export { LandingAiSection };
