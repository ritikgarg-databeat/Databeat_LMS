import type { Role } from '@prisma/client';

// Internal domain types for the qna-votes module.

/** Caller identity threaded through the service layer for RBAC/ownership checks. */
export interface Actor {
  id: string;
  role: Role;
}

/**
 * Exactly one of `questionId`/`answerId` is set — validated once in `QnaVotesService#toggle`
 * (the XOR check express-validator can't express across two independently-optional fields) and
 * trusted by `QnaVotesRepository#toggle`/accessibility helpers from then on.
 */
export interface VoteTarget {
  questionId?: string;
  answerId?: string;
}

export interface VoteToggleOutcome {
  voted: boolean;
  voteCount: number;
}
