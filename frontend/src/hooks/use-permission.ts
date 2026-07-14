import { useMemo } from 'react';

import type { Permission } from '@/constants/permissions';
import { hasAnyPermission, hasPermission } from '@/utils/permission';

// TODO(auth): replace with `useAuth().user.permissions` once the Auth feature lands.
// Hoisted so the reference is stable across renders (a fresh `[]` per render would
// otherwise defeat the useMemo dependency arrays below).
const NO_PERMISSIONS: Permission[] = [];

/** Reads the current user's permissions; returns `false` for everything until Auth exists. */
export function usePermission(required: Permission | Permission[]) {
  return useMemo(() => hasPermission(NO_PERMISSIONS, required), [required]);
}

export function useAnyPermission(required: Permission[]) {
  return useMemo(() => hasAnyPermission(NO_PERMISSIONS, required), [required]);
}
