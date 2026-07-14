// React hooks (TanStack Query) for the reports feature.
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getErrorMessage } from '@/utils/error';

import { reportsApi } from '../services';
import type { ReportKind } from '../types';

export interface DownloadReportVariables {
  kind: ReportKind;
  /** Filter params for the param-driven kinds (`progress`, `results`); ignored by the rest. */
  params?: Record<string, string | undefined>;
}

/**
 * One mutation for all four CSV exports — the export buttons on the reports page differ only by
 * `kind` (+ optional filters), so a single hook keeps their pending states independent per call
 * site while sharing the error toast. Success needs no handler: the browser download starting IS
 * the success feedback, and nothing in the query cache changes.
 */
export function useDownloadReportMutation() {
  return useMutation({
    mutationFn: ({ kind, params }: DownloadReportVariables) => {
      switch (kind) {
        case 'progress':
          return reportsApi.downloadProgressReport(params ?? {});
        case 'results':
          return reportsApi.downloadResultsReport(params ?? {});
        case 'groups':
          return reportsApi.downloadGroupsReport();
        case 'courses':
          return reportsApi.downloadCoursesReport();
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}
