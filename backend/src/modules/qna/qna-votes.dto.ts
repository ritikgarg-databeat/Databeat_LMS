// Request/response DTOs (API-facing shapes) for the qna-votes module.

/**
 * Body for `POST /qna/votes`. Exactly one of `questionId`/`answerId` must be set — the XOR
 * relationship across two independently-optional fields can't be expressed by express-validator
 * chains, so it's enforced in qna-votes.service.ts#toggle instead.
 */
export interface ToggleVoteDto {
  questionId?: string;
  answerId?: string;
}

/**
 * Shape returned by `POST /qna/votes` — "like/upvote" is a toggle (Prompt 7 § ANSWERS), so the
 * response always reflects the resulting state, not just "created".
 */
export interface VoteToggleResult {
  voted: boolean;
  voteCount: number;
}
