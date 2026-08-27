// TypeScript types and interfaces for the assessment feature.
//
// Covers three backend modules that live together under this one feature folder (Prompt 6):
// the question bank (`/questions`), assessment building (`/assessments`), and the trainee
// attempt/grading flow (`/assessments/:id/attempts`). Mirrors backend/src/prisma/schema.prisma's
// `Question`/`QuestionOption`/`Assessment`/`AssessmentQuestion`/`AssessmentGroupAssignment`/
// `AssessmentAttempt`/`AssessmentAnswer` models and their DTOs exactly — see each module's
// `*.dto.ts`/`*.types.ts`/`*.service.ts` for ground truth.

export type SortOrder = 'asc' | 'desc';

/* -------------------------------------------------------------------------- */
/* Questions (question bank)                                                  */
/* -------------------------------------------------------------------------- */

export type QuestionType =
  | 'SINGLE_CORRECT_MCQ'
  | 'MULTIPLE_CORRECT'
  | 'TRUE_FALSE'
  | 'FILL_IN_THE_BLANK'
  | 'SHORT_ANSWER'
  | 'LONG_ANSWER'
  | 'SQL_QUERY'
  | 'CODE_SNIPPET'
  | 'FILE_UPLOAD';

export type QuestionCategory =
  | 'PYTHON'
  | 'SQL'
  | 'STATISTICS'
  | 'DATA_ANALYTICS'
  | 'MACHINE_LEARNING'
  | 'POWER_BI'
  | 'EXCEL'
  | 'SPARK'
  | 'HADOOP'
  | 'GENERAL';

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type QuestionStatus = 'ACTIVE' | 'ARCHIVED';

export type QuestionSortField = 'createdAt' | 'title';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

/** Body shape for one option when creating/replacing a question's options. */
export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface QuestionCreatedBySummary {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * `GET /questions` list item — deliberately does NOT include `options` (kept lightweight for the
 * list view; fetch `Question` via `GET /questions/:id` for the full option set).
 */
export interface QuestionSummary {
  id: string;
  title: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  explanation: string | null;
  /** FILL_IN_THE_BLANK / SQL_QUERY only — `null` for every other type. */
  correctAnswers: string[] | null;
  /** CODE_SNIPPET only — `null` for every other type. */
  starterCode: string | null;
  /** CODE_SNIPPET only — `null` for every other type. */
  language: string | null;
  createdById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: QuestionCreatedBySummary | null;
  _count: { assessmentQuestions: number };
}

/** `GET /questions/:id` and the create/update responses — adds the ordered `options` array. */
export interface Question extends QuestionSummary {
  /** MCQ-family types (SINGLE_CORRECT_MCQ / MULTIPLE_CORRECT / TRUE_FALSE) only — `[]` otherwise. */
  options: QuestionOption[];
}

/**
 * Body for `POST /questions`. `type` picks which extra field(s) below are required — a field
 * that doesn't belong to the chosen `type` is rejected by the API if provided at all:
 * - `SINGLE_CORRECT_MCQ` / `MULTIPLE_CORRECT` / `TRUE_FALSE` -> `options` required (2-10 items;
 *   SINGLE_CORRECT_MCQ/TRUE_FALSE need exactly 1 `isCorrect: true`, MULTIPLE_CORRECT needs >= 1,
 *   TRUE_FALSE needs exactly 2 options total).
 * - `FILL_IN_THE_BLANK` / `SQL_QUERY` -> `correctAnswers` required (>= 1 non-empty string).
 * - `SHORT_ANSWER` / `LONG_ANSWER` / `FILE_UPLOAD` -> no extra fields.
 * - `CODE_SNIPPET` -> `starterCode`/`language` both optional.
 */
export interface CreateQuestionPayload {
  title: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  explanation?: string;
  options?: QuestionOptionInput[];
  correctAnswers?: string[];
  starterCode?: string;
  language?: string;
}

/**
 * Body for `PATCH /questions/:id` — identical type-conditional shape as `CreateQuestionPayload`
 * minus `type` itself, which is immutable after creation (a question may already be snapshotted
 * into an assessment). `null` explicitly clears a nullable field; omitting a field leaves it
 * unchanged. Do not offer a type selector in an edit form.
 */
export interface UpdateQuestionPayload {
  title?: string;
  category?: QuestionCategory;
  difficulty?: QuestionDifficulty;
  explanation?: string | null;
  options?: QuestionOptionInput[];
  correctAnswers?: string[];
  starterCode?: string | null;
  language?: string | null;
}

export interface UpdateQuestionStatusPayload {
  status: QuestionStatus;
}

export interface QuestionListFilters {
  category?: QuestionCategory;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  status?: QuestionStatus;
  search?: string;
}

export interface QuestionListParams extends QuestionListFilters {
  page: number;
  pageSize: number;
  sortBy?: QuestionSortField;
  sortOrder?: SortOrder;
}

/* -------------------------------------------------------------------------- */
/* Assessments                                                                */
/* -------------------------------------------------------------------------- */

export type AssessmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type AssessmentSortField = 'createdAt' | 'title' | 'dueDate';

export interface AssessmentCreatedBySummary {
  id: string;
  firstName: string;
  lastName: string;
}

/** Scalar fields shared by every assessment representation, regardless of viewer role. */
export interface Assessment {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  passingPercentage: number;
  availableFrom: string | null;
  dueDate: string | null;
  instructions: string | null;
  negativeMarkingEnabled: boolean;
  /** Only meaningful when `negativeMarkingEnabled` is true — `null` otherwise. */
  negativeMarksPerWrongAnswer: number | null;
  randomizeQuestions: boolean;
  showResultImmediately: boolean;
  resultsReleasedAt: string | null;
  status: AssessmentStatus;
  createdById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /assessments` list item (Trainer/Admin) — adds the derived counts. */
export interface AssessmentSummary extends Assessment {
  _count: {
    groupAssignments: number;
    questions: number;
    attempts: number;
  };
}

/** `GET /assessments/mine`'s per-item current-user attempt summary — `null` if not yet started. */
export interface MyAttemptSummary {
  status: AssessmentAttemptStatus;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

/**
 * `GET /assessments/mine` (Trainee) list item — published + group-assigned assessments only,
 * annotated with computed `questionCount`/`maxMarks` (there's no stored `maxMarks` field) and the
 * caller's own attempt summary.
 */
export interface MyAssessmentSummary extends Assessment {
  questionCount: number;
  maxMarks: number;
  myAttempt: MyAttemptSummary | null;
}

/** One group assigned to an assessment, as embedded in `AssessmentDetail.assignedGroups`. */
export interface AssessmentAssignedGroupSummary {
  id: string;
  name: string;
  code: string;
}

/**
 * `GET /assessments/:id` — Trainer/Admin gets full metadata for any assessment; a Trainee gets
 * the same shape but only for an assessment that's published and assigned to one of their groups
 * (403 otherwise). Does NOT include the question list itself — see `AssessmentQuestion` /
 * `assessmentsApi.listQuestions` for that (trainer-only, since it's the answer key).
 */
export interface AssessmentDetail extends Assessment {
  createdBy: AssessmentCreatedBySummary | null;
  questionCount: number;
  maxMarks: number;
  assignedGroups: AssessmentAssignedGroupSummary[];
}

/** `status` is deliberately absent — an assessment always starts DRAFT; see `UpdateAssessmentStatusPayload`. */
export interface CreateAssessmentPayload {
  title: string;
  description?: string;
  durationMinutes: number;
  passingPercentage: number;
  availableFrom?: string;
  dueDate?: string;
  instructions?: string;
  negativeMarkingEnabled?: boolean;
  negativeMarksPerWrongAnswer?: number;
  randomizeQuestions?: boolean;
  showResultImmediately?: boolean;
}

/** `status` is deliberately absent — status only ever changes via `updateStatus`. */
export interface UpdateAssessmentPayload {
  title?: string;
  description?: string | null;
  durationMinutes?: number;
  passingPercentage?: number;
  availableFrom?: string | null;
  dueDate?: string | null;
  instructions?: string | null;
  negativeMarkingEnabled?: boolean;
  negativeMarksPerWrongAnswer?: number | null;
  randomizeQuestions?: boolean;
  showResultImmediately?: boolean;
}

export interface UpdateAssessmentStatusPayload {
  status: AssessmentStatus;
}

export interface DuplicateAssessmentPayload {
  title: string;
}

export interface AssessmentListFilters {
  status?: AssessmentStatus;
  search?: string;
}

export interface AssessmentListParams extends AssessmentListFilters {
  page: number;
  pageSize: number;
  sortBy?: AssessmentSortField;
  sortOrder?: SortOrder;
}

export interface AssessmentStats {
  totalAssessments: number;
  publishedAssessments: number;
  draftAssessments: number;
  pendingGradingCount: number;
  upcomingCount: number;
}

/** `GET /assessments/:id/assignments` list item — `id` is the groupId. */
export interface AssessmentGroupAssignmentSummary extends AssessmentAssignedGroupSummary {
  memberCount: number;
}

export interface AssignGroupPayload {
  groupId: string;
}

/** Raw row returned by `POST /assessments/:id/assignments` — no nested `group` object. */
export interface AssessmentGroupAssignment {
  id: string;
  assessmentId: string;
  groupId: string;
  assignedById: string | null;
  assignedAt: string;
}

/**
 * `GET /assessments/:id/questions` item — the ordered, trainer-only answer key. Snapshots the
 * bank `Question`'s content at the moment it was added, so later bank edits/deletes never change
 * an already-built assessment or any attempt already made against it.
 */
export interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  /** Traceability back to the bank entry only — `null` if that Question was later hard-deleted. */
  questionId: string | null;
  order: number;
  marks: number;
  snapshotTitle: string;
  snapshotType: QuestionType;
  snapshotExplanation: string | null;
  /** MCQ-family types only — `null` otherwise. Includes `isCorrect` — this IS the answer key. */
  snapshotOptions: QuestionOption[] | null;
  /** FILL_IN_THE_BLANK / SQL_QUERY only — `null` otherwise. */
  snapshotCorrectAnswers: string[] | null;
  /** CODE_SNIPPET only — `null` otherwise. */
  snapshotStarterCode: string | null;
  /** CODE_SNIPPET only — `null` otherwise. */
  snapshotLanguage: string | null;
  createdAt: string;
}

export interface AddQuestionPayload {
  questionId: string;
  marks: number;
}

/** Marks-only re-weighting — the question's snapshotted content is immutable once added. */
export interface UpdateAssessmentQuestionPayload {
  marks: number;
}

/** Must be the full, exact set of this assessment's `AssessmentQuestion` ids — a partial list is rejected. */
export interface ReorderQuestionsPayload {
  orderedIds: string[];
}

/* -------------------------------------------------------------------------- */
/* Assessment attempts                                                        */
/* -------------------------------------------------------------------------- */

export type AssessmentAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'PENDING_REVIEW' | 'GRADED';

/** This trainee's own saved answer for one question, echoed back for pre-fill on resume. */
export interface SavedAnswer {
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  fileOriginalFilename: string | null;
}

/** `SnapshotOption` with `isCorrect` stripped — a trainee must never see the answer key ahead of grading. */
export interface SanitizedAttemptQuestionOption {
  id: string;
  text: string;
  order: number;
}

/**
 * Question shape returned to a trainee BEFORE results are revealed — `POST /start`'s question
 * list, and `GET /mine` while IN_PROGRESS/SUBMITTED/PENDING_REVIEW. `snapshotCorrectAnswers` /
 * `snapshotExplanation` are omitted entirely and every option's `isCorrect` flag is stripped.
 */
export interface SanitizedAttemptQuestion {
  id: string;
  /** 1-based presentation order — follows the attempt's shuffled order when randomized, else canonical `order`. */
  position: number;
  marks: number;
  snapshotTitle: string;
  snapshotType: QuestionType;
  snapshotOptions: SanitizedAttemptQuestionOption[] | null;
  snapshotStarterCode: string | null;
  snapshotLanguage: string | null;
  savedAnswer: SavedAnswer | null;
}

/** The attempt row itself, as embedded in trainee-facing responses (start/mine/submit). */
export interface Attempt {
  id: string;
  assessmentId: string;
  userId: string;
  status: AssessmentAttemptStatus;
  startedAt: string;
  expiresAt: string;
  remainingSeconds: number;
  submittedAt: string | null;
  submissionReason: 'LEARNER' | 'TIME_EXPIRED' | 'DUE_DATE_REACHED' | 'INTEGRITY_VIOLATION' | 'ADMIN' | null;
  gradedAt: string | null;
  timeSpentSeconds: number;
  totalScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  integrityViolationCount: number;
}

export type AssessmentIntegrityEventType =
  'FULLSCREEN_EXIT' | 'TAB_HIDDEN' | 'WINDOW_BLUR' | 'SCREENSHOT_ATTEMPT' | 'PRINT_ATTEMPT' | 'COPY_ATTEMPT';

export interface IntegrityEventResult {
  violationCount: number;
  warningsRemaining: number;
  autoSubmitted: boolean;
  attempt: Attempt;
}

/** `POST /assessments/:id/attempts/start` response — idempotent, also used to resume. */
export interface AttemptStartResponse {
  attempt: Attempt;
  questions: SanitizedAttemptQuestion[];
}

/**
 * Full, un-sanitized question + grading view — only ever returned once results are authorized to
 * be revealed: to a trainee via `GET /mine` when the attempt is GRADED and the assessment's
 * `showResultImmediately` is true.
 */
export interface GradedAttemptQuestion {
  id: string;
  position: number;
  marks: number;
  snapshotTitle: string;
  snapshotType: QuestionType;
  snapshotOptions: QuestionOption[] | null;
  snapshotCorrectAnswers: string[] | null;
  snapshotExplanation: string | null;
  snapshotStarterCode: string | null;
  snapshotLanguage: string | null;
  yourAnswer: SavedAnswer | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

export interface GradedAttemptResponse {
  attempt: Attempt;
  questions: GradedAttemptQuestion[];
}

/**
 * `GET /assessments/:id/attempts/mine` (Trainee) response. Verified directly from
 * assessment-attempts.service.ts#getMine (source, not just manual testing) — three cases:
 * - status !== 'GRADED' (IN_PROGRESS / SUBMITTED / PENDING_REVIEW): same sanitized shape as
 *   `AttemptStartResponse` (answer-key-free).
 * - status === 'GRADED' but `assessment.showResultImmediately` is false: `AttemptStartResponse`
 *   shape too, EXCEPT `attempt.totalScore`/`percentage`/`passed` are all forced to `null` and
 *   `questions` is always `[]` — results are simply never auto-revealed through this endpoint
 *   while the toggle is off (the real scores still exist in the DB, visible to staff only).
 * - status === 'GRADED' and `assessment.showResultImmediately` is true: `GradedAttemptResponse`
 *   — full answer key, per-question `isCorrect`/`marksAwarded`, and the attempt's final
 *   `totalScore`/`percentage`/`passed`.
 */
export type MyAttemptResponse = AttemptStartResponse | GradedAttemptResponse;

/**
 * Body for `PUT /mine/answers/:assessmentQuestionId`. Which field is meaningful depends on the
 * target question's `snapshotType` — `selectedOptionIds` for MCQ-family types, `textAnswer` for
 * the rest (FILE_UPLOAD is rejected here entirely; use the dedicated upload endpoint instead).
 */
export interface UpsertAnswerPayload {
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface AttemptListParams {
  page: number;
  pageSize: number;
  status?: AssessmentAttemptStatus;
}

export interface AttemptUserSummary {
  firstName: string;
  lastName: string;
  email: string;
}

/** `GET /assessments/:id/attempts` (Trainer/Admin) list item — the grading queue / results overview. */
export interface AttemptSummary {
  id: string;
  userId: string;
  user: AttemptUserSummary;
  status: AssessmentAttemptStatus;
  submittedAt: string | null;
  totalScore: number | null;
  percentage: number | null;
  passed: boolean | null;
}

export interface AttemptDetailUserSummary extends AttemptUserSummary {
  id: string;
}

/** The `AssessmentQuestion` context embedded in each `AttemptAnswerDetail` — includes the answer key. */
export interface AttemptQuestionContext {
  order: number;
  marks: number;
  snapshotTitle: string;
  snapshotType: QuestionType;
  snapshotOptions: QuestionOption[] | null;
  snapshotCorrectAnswers: string[] | null;
  snapshotExplanation: string | null;
  snapshotStarterCode: string | null;
  snapshotLanguage: string | null;
}

/** One answer row within `AttemptDetail.answers` (Trainer/Admin view, WITH the answer key). */
export interface AttemptAnswerDetail {
  id: string;
  assessmentQuestionId: string;
  question: AttemptQuestionContext;
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  fileOriginalFilename: string | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  gradedById: string | null;
  gradedAt: string | null;
}

/** `GET /assessments/:id/attempts/:attemptId` (Trainer/Admin) — full detail, WITH the answer key. */
export interface AttemptDetail {
  id: string;
  assessmentId: string;
  userId: string;
  user: AttemptDetailUserSummary;
  status: AssessmentAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  timeSpentSeconds: number;
  autoScore: number | null;
  manualScore: number | null;
  totalScore: number | null;
  percentage: number | null;
  passed: boolean | null;
  answers: AttemptAnswerDetail[];
}

/** Body for `PATCH /:attemptId/answers/:answerId/grade` — Trainer/Admin only. */
export interface GradeAnswerPayload {
  marksAwarded: number;
  isCorrect?: boolean;
}

/** Raw `AssessmentAnswer` row, as returned by the grade endpoint's `answer` field. */
export interface GradeAnswerRawAnswer {
  id: string;
  attemptId: string;
  assessmentQuestionId: string;
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  fileOriginalFilename: string | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  gradedById: string | null;
  gradedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * `PATCH /:attemptId/answers/:answerId/grade` response. `attempt.status` flips to `GRADED` (with
 * final `totalScore`/`percentage`/`passed`) only once every manual-review-type question in that
 * attempt has been graded; otherwise it stays `PENDING_REVIEW` with those three fields `null`.
 */
export interface GradeAnswerResult {
  attempt: Attempt;
  answer: GradeAnswerRawAnswer;
}
