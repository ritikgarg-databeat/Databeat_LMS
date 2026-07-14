// API calls for the reports feature, built on the shared Axios client.
//
// Each report endpoint streams raw CSV bytes with a `Content-Disposition: attachment` header —
// NOT the `{success, message, data}` JSON envelope — so these methods read the response as a
// `Blob` and trigger a browser download directly (same pattern as
// features/classroom/hooks' `useDownloadResource`), instead of returning data for rendering.
import { apiClient } from '@/services/api/client';

import type { ProgressReportParams, ReportKind, ResultsReportParams } from '../types';

/**
 * Pulls the server-chosen filename out of a `Content-Disposition` header, handling both the
 * RFC 5987 `filename*=UTF-8''...` form and the plain (optionally quoted) `filename=...` form.
 */
function parseContentDispositionFilename(headerValue: unknown, fallback: string): string {
  if (typeof headerValue !== 'string') return fallback;

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim());
    } catch {
      // Malformed percent-encoding — fall through to the plain `filename=` form.
    }
  }

  const plainMatch = /filename="?([^";]+)"?/i.exec(headerValue);
  return plainMatch?.[1]?.trim() || fallback;
}

/** Blob-anchor download: object URL → synthetic `<a download>` click → revoke. */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function downloadReportCsv(kind: ReportKind, params?: Record<string, string | undefined>): Promise<void> {
  const response = await apiClient.get<Blob>(`/reports/${kind}/export`, {
    responseType: 'blob',
    params,
  });
  const filename = parseContentDispositionFilename(
    response.headers['content-disposition'],
    `${kind}-report.csv`,
  );
  triggerBlobDownload(response.data, filename);
}

export const reportsApi = {
  downloadProgressReport(params: ProgressReportParams): Promise<void> {
    return downloadReportCsv('progress', params);
  },

  downloadResultsReport(params: ResultsReportParams): Promise<void> {
    return downloadReportCsv('results', params);
  },

  downloadGroupsReport(): Promise<void> {
    return downloadReportCsv('groups');
  },

  downloadCoursesReport(): Promise<void> {
    return downloadReportCsv('courses');
  },
};
