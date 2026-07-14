import type { QuestionCategory, QuestionDifficulty, QuestionStatus, QuestionType } from '@prisma/client';

export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionDto {
  title: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  explanation?: string;
  // MCQ-family only (SINGLE_CORRECT_MCQ / MULTIPLE_CORRECT / TRUE_FALSE) — see
  // questions.service.ts#assertTypeConditionalFields for the per-type invariants enforced.
  options?: QuestionOptionInput[];
  // FILL_IN_THE_BLANK / SQL_QUERY only.
  correctAnswers?: string[];
  // CODE_SNIPPET only.
  starterCode?: string;
  language?: string;
}

// `type` is deliberately absent — a question's type is immutable after creation (Prompt 6 §
// PATCH /questions/:id) since it may already have been snapshotted into an assessment; a
// trainer who needs a different type creates a new question instead.
export interface UpdateQuestionDto {
  title?: string;
  category?: QuestionCategory;
  difficulty?: QuestionDifficulty;
  explanation?: string | null;
  options?: QuestionOptionInput[];
  correctAnswers?: string[];
  starterCode?: string | null;
  language?: string | null;
}

export interface UpdateQuestionStatusDto {
  status: QuestionStatus;
}

export interface ListQuestionsQueryDto {
  page?: string;
  pageSize?: string;
  category?: QuestionCategory;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  status?: QuestionStatus;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}
