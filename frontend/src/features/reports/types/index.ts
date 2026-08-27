// TypeScript types for the reports feature (CSV export endpoints).
//
// The param shapes are deliberately type ALIASES (not interfaces) so they pick up an implicit
// index signature and stay assignable to the `Record<string, string | undefined>` bag that
// `useDownloadReportMutation` threads through to axios `params`.

/** The four CSV exports the backend serves at `GET /reports/<kind>/export`. */
export type ReportKind = 'progress' | 'results' | 'groups' | 'courses' | 'mandatory';

export type ProgressReportParams = {
  groupId?: string;
  courseId?: string;
};

export type ResultsReportParams = {
  assessmentId?: string;
  groupId?: string;
};
