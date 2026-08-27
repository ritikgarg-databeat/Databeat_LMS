// Internal + API-facing shapes for the lesson-quiz module.

export interface QuizOption {
  id: string;
  text: string;
}

/** The `LessonQuizAttempt.questions` Json shape — server-only, `correctOptionId` is never
 * serialized to the client until the attempt is SUBMITTED. */
export interface StoredQuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
  correctOptionId: string;
}

export type SanitizedQuizQuestion = Omit<StoredQuizQuestion, 'correctOptionId'>;

export interface LessonContentForQuiz {
  lessonTitle: string;
  lessonDescription: string | null;
  content: string;
  contentVersion: number;
  isMandatory: boolean;
  /** True when a file exists but cannot provide reliable text (scan, image, video, or failure). */
  hasOpaqueFileContent: boolean;
}

export type LessonQuizView =
  | { required: false }
  | { required: true; status: 'GENERATED'; passingPercentage: number; questions: SanitizedQuizQuestion[] }
  | {
      required: true;
      status: 'SUBMITTED';
      score: number;
      totalQuestions: number;
      percentage: number;
      passingPercentage: number;
      passed: boolean;
    };

export interface LessonQuizResultQuestion {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
}

export interface LessonQuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  passingPercentage: number;
  passed: boolean;
  results: LessonQuizResultQuestion[];
}
