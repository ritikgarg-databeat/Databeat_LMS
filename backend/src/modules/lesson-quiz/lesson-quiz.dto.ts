// Request DTOs for the lesson-quiz module.

/** Body for `POST /lessons/:id/quiz/submit`. One entry per question the trainee saw — an
 * omitted questionId is graded as unanswered (incorrect), never rejected as invalid. */
export interface SubmitLessonQuizDto {
  answers: { questionId: string; selectedOptionId: string }[];
}
