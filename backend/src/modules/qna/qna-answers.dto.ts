// Request/response DTOs (API-facing shapes) for the qna-answers module.

export interface CreateAnswerDto {
  questionId: string;
  content: string;
}

export interface UpdateAnswerDto {
  content: string;
}

export interface PinAnswerDto {
  isPinned: boolean;
}

/** Body for `verify` — the question id itself comes from the URL, handled by the controller. */
export interface VerifyAnswerDto {
  answerId: string;
}
