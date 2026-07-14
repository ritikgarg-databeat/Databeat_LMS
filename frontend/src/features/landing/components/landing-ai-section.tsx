import { motion, useReducedMotion } from 'framer-motion';
import { ListChecks, MessageCircleQuestion, Sparkles, Target, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';

interface Capability {
  icon: LucideIcon;
  label: string;
}

const CAPABILITIES: Capability[] = [
  { icon: MessageCircleQuestion, label: 'Ask AI about lessons' },
  { icon: Wand2, label: 'Generate explanations' },
  { icon: ListChecks, label: 'Practice questions' },
  { icon: Target, label: 'Personalized recommendations' },
];

/**
 * "The AI part" of the landing page — a tinted panel pairing the four AI capabilities with a
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

  return (
    <section className="bg-muted/40 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.div {...motionProps} className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Learning, with AI built in</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Every lesson comes with an AI assistant that can explain, quiz, and guide — so no one
              gets stuck alone.
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
           * the literal "AI" pitch, so a futuristic glow reads as intentional rather than noisy. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              aria-hidden="true"
              className="bg-brand-gradient-animated pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-30 blur-2xl"
            />
            <Card className="w-full p-4 shadow-glow sm:p-5" aria-hidden="true">
              <div className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                    Explain SQL joins simply
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-brand-gradient flex size-7 shrink-0 items-center justify-center rounded-full">
                    <Sparkles className="size-3.5 text-primary-foreground" aria-hidden />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2 text-sm text-card-foreground">
                    Think of joins as combining two spreadsheets by a shared column — an INNER join
                    keeps only matching rows, a LEFT join keeps every row from the first table too.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export { LandingAiSection };
