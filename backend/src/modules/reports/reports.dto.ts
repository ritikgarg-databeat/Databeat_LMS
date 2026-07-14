// Request/response DTOs (API-facing shapes) for the reports module. Responses are CSV bodies
// (see reports.controller.ts), so only query DTOs live here — typed as the raw strings Express
// hands the controller, mirroring ListQnaQuestionsQueryDto's convention.

/** Raw (string) query params for `GET /reports/progress/export`. */
export interface ProgressExportQueryDto {
  /** Narrows the export to one group (403 for a trainer whose group it isn't). */
  groupId?: string;
  /** Narrows the export to one course (404 if missing/soft-deleted). */
  courseId?: string;
}

/** Raw (string) query params for `GET /reports/results/export`. */
export interface ResultsExportQueryDto {
  /** Narrows the export to one assessment (404 if missing/soft-deleted). */
  assessmentId?: string;
  /** Narrows the export to one group (403 for a trainer whose group it isn't). */
  groupId?: string;
}
