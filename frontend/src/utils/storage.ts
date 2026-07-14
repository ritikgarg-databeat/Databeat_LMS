/**
 * Thin, typed wrapper around `window.localStorage`. Centralizing access here means
 * a future swap to a different persistence mechanism (e.g. IndexedDB) touches one file.
 * Fails silently (returns/no-ops) in environments where storage is unavailable
 * (SSR, privacy mode) rather than throwing and breaking the render.
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota/availability errors — persistence is a nice-to-have, not critical path.
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  },
};
