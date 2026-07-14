import { create } from 'zustand';

/** localStorage key for the desktop sidebar's collapsed/expanded choice — see `isSidebarCollapsed`. */
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'databeat-lms:sidebar-collapsed';

function readPersistedSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    // localStorage can throw in locked-down environments (e.g. privacy mode) — default to expanded.
    return false;
  }
}

function persistSidebarCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
  } catch {
    // Ignore write failures — the in-memory store state still reflects the user's choice for
    // the current session even if it can't be persisted across reloads.
  }
}

/**
 * Pure client/UI state only — never server data (that belongs to TanStack Query, see
 * ARCHITECTURE.md §12). Sidebar/mobile-nav open state is the canonical example of what
 * belongs here.
 */
interface UIState {
  isMobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  /** Desktop-only icon-rail mode for `Sidebar`; mobile's drawer nav always shows full labels. */
  isSidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  isMobileNavOpen: false,
  openMobileNav: () => set({ isMobileNavOpen: true }),
  closeMobileNav: () => set({ isMobileNavOpen: false }),

  isSidebarCollapsed: readPersistedSidebarCollapsed(),
  toggleSidebarCollapsed: () => {
    const next = !get().isSidebarCollapsed;
    persistSidebarCollapsed(next);
    set({ isSidebarCollapsed: next });
  },
}));
