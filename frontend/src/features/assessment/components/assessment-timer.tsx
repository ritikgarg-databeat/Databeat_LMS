// A real, self-enforcing exam countdown — not decorative. Ticks down once per second from
// `totalSeconds` (computed server-side from the immutable attempt expiry) and
// calls `onExpire` exactly once when it reaches zero, regardless of React 19 StrictMode's dev-only
// double-invocation of effects (guarded by `hasExpiredRef`, mirroring the ref-guard pattern used
// for the mount effect in `lesson-viewer-page.tsx`).
import { Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

export interface AssessmentTimerProps {
  /** Seconds remaining as of mount. Fixed for the component's lifetime — it owns its own tick. */
  totalSeconds: number;
  /** Fired exactly once, when the countdown reaches zero. */
  onExpire: () => void;
  className?: string;
}

/** Below this many remaining seconds, the timer switches to a "running out" warning style. */
const WARNING_THRESHOLD_SECONDS = 5 * 60;

function formatCountdown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function AssessmentTimer({ totalSeconds, onExpire, className }: AssessmentTimerProps) {
  const [remaining, setRemaining] = useState(() => Math.max(0, totalSeconds));

  // Stashed in a ref so the interval effect below never needs `onExpire` in its dependency array —
  // its identity isn't guaranteed stable render over render, and re-running the interval just
  // because of that would restart the countdown. Synced in an effect (not during render), since
  // refs must only be written outside of render.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // Guards against calling `onExpire` more than once — both StrictMode's double-invoked effects
  // and the ordinary "already at zero on mount" case funnel through this same guard.
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    if (totalSeconds <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current();
      }
      return;
    }

    const intervalId = setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpireRef.current();
          }
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
    // Deliberately keyed only on `totalSeconds` (the starting point) — the countdown owns its own
    // tick via `setRemaining`'s updater form, so it never needs to re-read `remaining` here.
  }, [totalSeconds]);

  const isWarning = remaining <= WARNING_THRESHOLD_SECONDS;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums',
        isWarning ? 'border-destructive/50 bg-destructive/10 text-destructive' : 'text-foreground',
        className,
      )}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${formatCountdown(remaining)}`}
    >
      <Clock className="size-4" aria-hidden />
      {formatCountdown(remaining)}
    </div>
  );
}

export { AssessmentTimer };
