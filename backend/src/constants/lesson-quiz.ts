/** Bounds for the AI-generated lesson completion quiz (see modules/lesson-quiz). */
export const LESSON_QUIZ_MIN_QUESTIONS = 4;
export const LESSON_QUIZ_MAX_QUESTIONS = 5;
export const LESSON_QUIZ_OPTION_COUNT = 4;

/** Below this many characters of real lesson content, there's nothing honest to quiz on —
 * "Mark as complete" works directly, same as before this feature existed. */
export const LESSON_QUIZ_MIN_CONTENT_CHARS = 40;

/** Mirrors AI_CONTEXT_MAX_LESSON_CONTENT_CHARS (constants/ai.ts) — same truncation bound
 * applied to the quiz-generation prompt's lesson content. */
export const LESSON_QUIZ_MAX_CONTENT_CHARS = 6000;
