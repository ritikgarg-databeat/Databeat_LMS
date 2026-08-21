/** Bounds for the AI-generated lesson completion quiz (see modules/lesson-quiz). */
export const LESSON_QUIZ_MIN_QUESTIONS = 4;
export const LESSON_QUIZ_MAX_QUESTIONS = 5;
export const LESSON_QUIZ_OPTION_COUNT = 4;
export const LESSON_QUIZ_PASS_PERCENTAGE = 70;

/** Below this many characters of real lesson content, there's nothing honest to quiz on —
 * "Mark as complete" works directly, same as before this feature existed. */
export const LESSON_QUIZ_MIN_CONTENT_CHARS = 40;

/** Independent truncation bound for the quiz-generation prompt's lesson content. */
export const LESSON_QUIZ_MAX_CONTENT_CHARS = 6000;
