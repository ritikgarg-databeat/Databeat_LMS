// React hooks (including TanStack Query hooks) for the settings feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuth } from '@/hooks/use-auth';

import { settingsApi } from '../services';
import type { NotificationType, ThemePreference, UpdatePlatformSettingsPayload } from '../types';

const SETTINGS_QUERY_KEY = 'settings';
const NOTIFICATION_PREFERENCES_QUERY_KEY = 'settings-notification-preferences';
const PLATFORM_SETTINGS_QUERY_KEY = 'settings-platform';
const AVATAR_BLOB_QUERY_KEY = 'settings-avatar-blob';
const TRAINER_VIDEO_LIMIT_QUERY_KEY = 'settings-trainer-video-limit';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

export function useSettingsQuery() {
  return useQuery({
    queryKey: [SETTINGS_QUERY_KEY],
    queryFn: () => settingsApi.getSettings(),
  });
}

export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: [NOTIFICATION_PREFERENCES_QUERY_KEY],
    queryFn: () => settingsApi.getNotificationPreferences(),
  });
}

/**
 * SUPER_ADMIN only server-side (403 otherwise) — this hook does NOT gate on role itself, matching
 * this codebase's precedent elsewhere of API-level, not hook-level, RBAC. The caller (a
 * SUPER_ADMIN-only page/route) decides whether to mount it.
 */
export function usePlatformSettingsQuery() {
  return useQuery({
    queryKey: [PLATFORM_SETTINGS_QUERY_KEY],
    queryFn: () => settingsApi.getPlatformSettings(),
  });
}

export function useTrainerVideoLimitQuery() {
  return useQuery({
    queryKey: [TRAINER_VIDEO_LIMIT_QUERY_KEY],
    queryFn: () => settingsApi.getTrainerVideoLimit(),
  });
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

export function useUpdateThemeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: ThemePreference) => settingsApi.updateTheme(theme),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    },
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mutedTypes: NotificationType[]) => settingsApi.updateNotificationPreferences(mutedTypes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [NOTIFICATION_PREFERENCES_QUERY_KEY] });
      // `GET /settings` also embeds `mutedNotificationTypes` — keep it in sync too.
      void queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
    },
  });
}

/**
 * `setUser` (from `useAuth`, backed by `AuthContext`/`AuthProvider`) is the actual source of
 * truth for the current user's avatar across the app (header user menu, profile page) — unlike
 * most other features, there is no TanStack Query key holding "current user"; it's plain React
 * context state, mutated imperatively. Updating it here (instead of/alongside cache invalidation)
 * is what makes the new avatar show up everywhere without a full page reload.
 */
export function useUploadAvatarMutation() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuth();
  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadAvatar(file),
    onSuccess: ({ avatar }) => {
      void queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
      if (user) setUser({ ...user, avatar });
    },
  });
}

export function useDeleteAvatarMutation() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuth();
  return useMutation({
    mutationFn: () => settingsApi.deleteAvatar(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [SETTINGS_QUERY_KEY] });
      if (user) setUser({ ...user, avatar: null });
    },
  });
}

/**
 * `User.avatar` can hold two different shapes: a relative path our own upload endpoint wrote
 * (e.g. `avatars/<uuid>.png`), or a full external URL set via the pre-existing profile page's
 * "Avatar URL" text field (predates Prompt 9's upload feature) — the backend's own
 * `isOwnedAvatarPath` draws this exact distinction for the same reason (see
 * settings.service.ts#deleteOldAvatarBestEffort's doc comment).
 */
function isExternalAvatarUrl(avatarPath: string): boolean {
  return /^https?:\/\//i.test(avatarPath);
}

/**
 * For rendering the current user's own avatar image anywhere in the app (header user menu,
 * profile settings card, profile page). An external URL (see `isExternalAvatarUrl` above) is
 * directly fetchable by the browser and returned as-is with no request of our own. Otherwise this
 * mirrors the classroom feature's `useAuthenticatedMediaUrl` exactly, for the same reason:
 * `GET /settings/avatar` requires an `Authorization` header a plain `<img src>` can't attach, so
 * the bytes are fetched through `apiClient` (whose interceptor DOES attach the bearer token) as a
 * `Blob`, then wrapped in a same-origin `blob:` object URL safe to hand to a plain `src` attribute.
 *
 * Keyed on `avatarPath` (the current user's `avatar` field) so a fresh upload/removal — which
 * updates `avatarPath` via `setUser` in `useUploadAvatarMutation`/`useDeleteAvatarMutation` above
 * — automatically triggers a refetch; `null`/`undefined` disables the query entirely rather than
 * hitting the endpoint just to get a 404.
 */
export function useAuthenticatedAvatarUrl(avatarPath: string | null | undefined): {
  url: string | null;
  isLoading: boolean;
} {
  const isExternal = Boolean(avatarPath) && isExternalAvatarUrl(avatarPath as string);

  const { data: blob, isLoading } = useQuery({
    queryKey: [AVATAR_BLOB_QUERY_KEY, avatarPath],
    queryFn: () => settingsApi.downloadAvatar(),
    enabled: Boolean(avatarPath) && !isExternal,
  });

  // Derived during render (memoized on `blob`'s identity), not via a `useEffect` + `useState`
  // pair — react-query only hands back a new `Blob` reference when the bytes actually change.
  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    // Cleanup-only effect: runs before the next `objectUrl` is committed and on unmount — either
    // way, `objectUrl` here is always the *previous* one, safe to revoke.
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (isExternal) return { url: avatarPath as string, isLoading: false };
  return { url: objectUrl, isLoading };
}

/** SUPER_ADMIN only server-side — see `usePlatformSettingsQuery`'s doc comment. */
export function useUpdatePlatformSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePlatformSettingsPayload) => settingsApi.updatePlatformSettings(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [PLATFORM_SETTINGS_QUERY_KEY] });
    },
  });
}

export function useUpdateTrainerVideoLimitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dailyLimit: number | null) => settingsApi.updateTrainerVideoLimit(dailyLimit),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TRAINER_VIDEO_LIMIT_QUERY_KEY] });
    },
  });
}
