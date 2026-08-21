import { QueryClient } from '@tanstack/react-query';
import axios from 'axios';

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (!axios.isAxiosError(error)) return true;
  const status = error.response?.status;
  return status === undefined || status === 429 || status >= 500;
}

/**
 * Single shared TanStack Query client. Defaults favor an admin/LMS dashboard workload:
 * data doesn't need to refetch on every window focus, but should be considered stale
 * fairly quickly since multiple roles can mutate the same underlying records.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery,
      retryDelay: 500,
    },
    mutations: {
      retry: 0,
    },
  },
});
