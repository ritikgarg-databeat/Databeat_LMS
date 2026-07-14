import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared TanStack Query client. Defaults favor an admin/LMS dashboard workload:
 * data doesn't need to refetch on every window focus, but should be considered stale
 * fairly quickly since multiple roles can mutate the same underlying records.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
