import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';

import { MOTIVATIONAL_MESSAGES } from '@/constants/motivational-messages';
import type { Role } from '@/constants/roles';

export interface MotivationalMessageProps {
  userId: string;
  role: Role;
  loginMarker: string | null;
}

interface StoredSelection {
  loginMarker: string;
  index: number;
}

const STORAGE_KEY_PREFIX = 'databeat-lms:motivation';

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getMessage(userId: string, role: Role, loginMarker: string | null): string {
  const messages = MOTIVATIONAL_MESSAGES[role];
  const marker = loginMarker ?? 'current-session';
  const storageKey = `${STORAGE_KEY_PREFIX}:${userId}:${role}`;
  let previous: StoredSelection | null = null;

  try {
    previous = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null') as StoredSelection | null;
  } catch {
    previous = null;
  }

  if (
    previous?.loginMarker === marker &&
    Number.isInteger(previous.index) &&
    previous.index >= 0 &&
    previous.index < messages.length
  ) {
    return messages[previous.index]!;
  }

  let index = hashString(`${userId}:${role}:${marker}`) % messages.length;
  if (previous && index === previous.index && messages.length > 1) {
    index = (index + 1) % messages.length;
  }

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ loginMarker: marker, index }));
  } catch {
    // Storage may be unavailable in privacy-restricted contexts; the deterministic choice still works.
  }

  return messages[index]!;
}

/** One role-aware thought per login, kept stable across navigation and page refreshes. */
function MotivationalMessage({ userId, role, loginMarker }: MotivationalMessageProps) {
  const message = useMemo(() => getMessage(userId, role, loginMarker), [userId, role, loginMarker]);

  return (
    <div className="flex min-w-0 items-center justify-center gap-2" title={message}>
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="truncate text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export { MotivationalMessage };
