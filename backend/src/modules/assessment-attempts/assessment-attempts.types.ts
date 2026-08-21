import {
  QuestionType,
  type AssessmentAttemptStatus,
  type AssessmentSubmissionReason,
} from '@prisma/client';

// Internal domain types for the assessment-attempts module.

/**
 * MCQ-family types — graded by comparing the SET of `selectedOptionIds` against the SET of
 * `snapshotOptions` ids where `isCorrect === true` (Prompt 6 § AUTO GRADING). Also the set of
 * types whose `PUT /mine/answers/:assessmentQuestionId` body must be `{ selectedOptionIds }`.
 */
export const OPTION_BASED_QUESTION_TYPES = [
  QuestionType.SINGLE_CORRECT_MCQ,
  QuestionType.MULTIPLE_CORRECT,
  QuestionType.TRUE_FALSE,
] as const;

/**
 * Free-text types that are still auto-gradable — graded by normalizing (trim + lowercase +
 * collapse whitespace) the submitted `textAnswer` and checking it against the normalized
 * `snapshotCorrectAnswers` array for ANY match.
 */
export const AUTO_GRADABLE_TEXT_QUESTION_TYPES = [QuestionType.FILL_IN_THE_BLANK, QuestionType.SQL_QUERY] as const;

/** Union of every type graded immediately at submit time (Prompt 6 § AUTO GRADING). */
export const AUTO_GRADABLE_QUESTION_TYPES = [
  ...OPTION_BASED_QUESTION_TYPES,
  ...AUTO_GRADABLE_TEXT_QUESTION_TYPES,
] as const;

/**
 * Always routed to manual trainer review regardless of whether an answer was submitted
 * (Prompt 6 § AUTO GRADING). `FILE_UPLOAD` is also the only type answered via the dedicated
 * upload endpoint rather than `PUT /mine/answers/:assessmentQuestionId`.
 */
export const MANUAL_REVIEW_QUESTION_TYPES = [
  QuestionType.SHORT_ANSWER,
  QuestionType.LONG_ANSWER,
  QuestionType.CODE_SNIPPET,
  QuestionType.FILE_UPLOAD,
] as const;

/** Every non-FILE_UPLOAD type answered via `PUT /mine/answers/:assessmentQuestionId` with `{ textAnswer }`. */
export const TEXT_BASED_QUESTION_TYPES = [
  QuestionType.FILL_IN_THE_BLANK,
  QuestionType.SHORT_ANSWER,
  QuestionType.LONG_ANSWER,
  QuestionType.SQL_QUERY,
  QuestionType.CODE_SNIPPET,
] as const;

/** Shape of one entry in `AssessmentQuestion.snapshotOptions` (see schema.prisma doc comment). */
export interface SnapshotOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

/** `SnapshotOption` with `isCorrect` stripped — never let a trainee see the answer key ahead of grading. */
export type SanitizedSnapshotOption = Omit<SnapshotOption, 'isCorrect'>;

/** This trainee's own saved answer for one question, echoed back for pre-fill on resume. */
export interface SavedAnswerView {
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  fileOriginalFilename: string | null;
}

export interface AttemptSummary {
  id: string;
  assessmentId: string;
  userId: string;
  status: AssessmentAttemptStatus;
  startedAt: Date;
  expiresAt: Date;
  remainingSeconds: number;
  submittedAt: Date | null;
  submissionReason: AssessmentSubmissionReason | null;
  gradedAt: Date | null;
  timeSpentSeconds: number;
  totalScore: number | null;
  percentage: number | null;
  passed: boolean | null;
}

/**
 * Question shape returned to a trainee BEFORE results are revealed (`/start`, and `/mine` while
 * IN_PROGRESS/SUBMITTED/PENDING_REVIEW) — `snapshotCorrectAnswers`/`snapshotExplanation` are
 * omitted entirely and `snapshotOptions` has every `isCorrect` flag stripped (Prompt 6 §
 * SECURITY — a trainee must never receive the answer key before/without grading).
 */
export interface SanitizedQuestionView {
  id: string;
  /** 1-based presentation order — follows the attempt's `questionOrder` when randomized, else canonical `order`. */
  position: number;
  marks: number;
  snapshotTitle: string;
  snapshotType: QuestionType;
  snapshotOptions: SanitizedSnapshotOption[] | null;
  snapshotStarterCode: string | null;
  snapshotLanguage: string | null;
  savedAnswer: SavedAnswerView | null;
}

/**
 * Full, un-sanitized question + grading view — only ever returned once results are authorized
 * to be revealed: to a trainee via `GET /mine` when GRADED and `showResultImmediately` is on, or
 * to Trainer/Super-Admin via the trainer-only endpoints (who may always see the answer key).
 */
export interface GradedQuestionView {
  id: string;
  position: number;
  marks: number;
  snapshotTitle: string;
  snapshotType: QuestionType;
  snapshotOptions: SnapshotOption[] | null;
  snapshotCorrectAnswers: unknown;
  snapshotExplanation: string | null;
  snapshotStarterCode: string | null;
  snapshotLanguage: string | null;
  yourAnswer: SavedAnswerView | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

export interface AttemptWithSanitizedQuestions {
  attempt: AttemptSummary;
  questions: SanitizedQuestionView[];
}

export interface AttemptWithGradedQuestions {
  attempt: AttemptSummary;
  questions: GradedQuestionView[];
}

export interface TrainerAttemptListItem {
  id: string;
  userId: string;
  user: { firstName: string; lastName: string; email: string };
  status: AttemptSummary['status'];
  submittedAt: Date | null;
  totalScore: number | null;
  percentage: number | null;
  passed: boolean | null;
}
