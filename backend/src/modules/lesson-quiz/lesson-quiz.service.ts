import { randomUUID } from 'node:crypto';

import { LessonQuizAttemptStatus, type Prisma, type Role } from '@prisma/client';

import {
  LESSON_QUIZ_MAX_CONTENT_CHARS,
  LESSON_QUIZ_MAX_QUESTIONS,
  LESSON_QUIZ_MIN_CONTENT_CHARS,
  LESSON_QUIZ_MIN_QUESTIONS,
  LESSON_QUIZ_OPTION_COUNT,
} from '@/constants/lesson-quiz';
import { aiProvider } from '@/modules/ai';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

import type { SubmitLessonQuizDto } from './lesson-quiz.dto';
import { LessonQuizRepository } from './lesson-quiz.repository';
import type { LessonQuizResult, LessonQuizView, SanitizedQuizQuestion, StoredQuizQuestion } from './lesson-quiz.types';

interface Actor {
  id: string;
  role: Role;
}

type RawQuizPayload = { questions: { text: string; options: string[]; correctIndex: number }[] };

const QUIZ_SYSTEM_PROMPT =
  'You are a quiz generator embedded in an LMS. You will be given a lesson\'s title and its ' +
  'theory content. Generate a short multiple-choice quiz that tests understanding of THAT ' +
  `content only — never invent facts not present in it. Produce between ${LESSON_QUIZ_MIN_QUESTIONS} ` +
  `and ${LESSON_QUIZ_MAX_QUESTIONS} questions, each with exactly ${LESSON_QUIZ_OPTION_COUNT} ` +
  'plausible options and exactly one correct answer. Respond with ONLY a single JSON object — ' +
  'no markdown code fences, no commentary before or after — matching exactly this shape: ' +
  '{"questions":[{"text":"...","options":["...","...","...","..."],"correctIndex":0}]}. ' +
  'correctIndex is the 0-based index of the correct option.';

/**
 * Business logic for the lesson-quiz module. Controllers call into this layer only.
 *
 * `getOrCreateAttempt` is the single source of truth both public entry points funnel through —
 * `getOrGenerate` (the trainee-facing display fetch) and `checkCompletionGate` (called from
 * progress.service.ts before allowing "Mark as complete") always agree on the same generated
 * question set, and calling either one is what closes the "never open the quiz UI" bypass: the
 * gate check itself generates the quiz on first ask, it doesn't just look for one that might
 * already exist.
 */
export class LessonQuizService extends BaseService {
  constructor(protected readonly repository: LessonQuizRepository = new LessonQuizRepository()) {
    super();
  }

  async getOrGenerate(lessonId: string, actor: Actor): Promise<LessonQuizView> {
    await this.assertLessonReadable(lessonId, actor);
    const attempt = await this.getOrCreateAttempt(lessonId, actor.id);
    if (!attempt) return { required: false };

    if (attempt.status === LessonQuizAttemptStatus.SUBMITTED) {
      return {
        required: true,
        status: 'SUBMITTED',
        score: attempt.score ?? 0,
        totalQuestions: attempt.totalQuestions,
        percentage: attempt.percentage ?? 0,
      };
    }

    return {
      required: true,
      status: 'GENERATED',
      questions: this.sanitizeQuestions(attempt.questions as unknown as StoredQuizQuestion[]),
    };
  }

  async submit(lessonId: string, actor: Actor, dto: SubmitLessonQuizDto): Promise<LessonQuizResult> {
    await this.assertLessonReadable(lessonId, actor);

    const attempt = await this.repository.findAttempt(lessonId, actor.id);
    if (!attempt) throw new NotFoundError('No quiz has been generated for this lesson yet.');
    if (attempt.status === LessonQuizAttemptStatus.SUBMITTED) {
      throw new BadRequestError('This quiz has already been submitted.');
    }

    const questions = attempt.questions as unknown as StoredQuizQuestion[];
    const selectedOptionByQuestionId = new Map(dto.answers.map((answer) => [answer.questionId, answer.selectedOptionId]));

    let correctCount = 0;
    const results = questions.map((question) => {
      const selectedOptionId = selectedOptionByQuestionId.get(question.id) ?? null;
      const isCorrect = selectedOptionId === question.correctOptionId;
      if (isCorrect) correctCount += 1;
      return { questionId: question.id, selectedOptionId, correctOptionId: question.correctOptionId, isCorrect };
    });

    const percentage = Math.round((correctCount / questions.length) * 100);
    const selectedAnswersRecord = Object.fromEntries(
      dto.answers.map((answer) => [answer.questionId, answer.selectedOptionId]),
    );

    await this.repository.submitAttempt(attempt.id, {
      status: LessonQuizAttemptStatus.SUBMITTED,
      selectedAnswers: selectedAnswersRecord as Prisma.InputJsonValue,
      score: correctCount,
      percentage,
      submittedAt: new Date(),
    });

    return { score: correctCount, totalQuestions: questions.length, percentage, results };
  }

  /** Called from progress.service.ts right before it allows a transition into COMPLETED. */
  async checkCompletionGate(lessonId: string, actor: Actor): Promise<void> {
    await this.assertLessonReadable(lessonId, actor);
    const attempt = await this.getOrCreateAttempt(lessonId, actor.id);
    if (attempt && attempt.status === LessonQuizAttemptStatus.GENERATED) {
      throw new ForbiddenError('Complete the lesson quiz before marking it complete.');
    }
  }

  private async getOrCreateAttempt(lessonId: string, userId: string) {
    const existing = await this.repository.findAttempt(lessonId, userId);
    if (existing) return existing;

    const lessonContent = await this.repository.findLessonContentForQuiz(lessonId);
    if (!lessonContent) throw new NotFoundError('Lesson not found.');

    const combinedContent = [lessonContent.lessonDescription, lessonContent.content]
      .filter((part): part is string => Boolean(part && part.trim().length > 0))
      .join('\n\n')
      .trim();

    // Not enough real content to honestly quiz on — mirrors today's direct-complete behavior.
    if (combinedContent.length < LESSON_QUIZ_MIN_CONTENT_CHARS) return null;

    const questions = await this.generateQuestions(
      lessonContent.lessonTitle,
      combinedContent.slice(0, LESSON_QUIZ_MAX_CONTENT_CHARS),
    );
    if (!questions) return null; // AI unavailable or persistently malformed — graceful fallback

    return this.repository.createAttempt({
      lesson: { connect: { id: lessonId } },
      user: { connect: { id: userId } },
      questions: questions as unknown as Prisma.InputJsonValue,
      totalQuestions: questions.length,
    });
  }

  /**
   * Tries the AI provider, retrying once with a stricter reminder if the response isn't valid
   * JSON matching the expected shape. Any persistent failure — including the 503
   * `aiProvider.chat` throws today with no `ANTHROPIC_API_KEY` configured — logs a warning and
   * returns `null` rather than throwing, so "Mark as complete" degrades to its pre-existing
   * direct-complete behavior instead of permanently blocking every trainee.
   */
  private async generateQuestions(lessonTitle: string, content: string): Promise<StoredQuizQuestion[] | null> {
    const baseMessage = `Lesson title: ${lessonTitle}\n\nLesson content:\n${content}`;

    for (let attemptNumber = 0; attemptNumber < 2; attemptNumber += 1) {
      const userMessage =
        attemptNumber === 0
          ? baseMessage
          : `${baseMessage}\n\nYour previous response was not valid JSON matching the required shape. Respond with ONLY the JSON object this time.`;

      let rawContent: string;
      try {
        const output = await aiProvider.chat({ systemPrompt: QUIZ_SYSTEM_PROMPT, history: [], userMessage });
        rawContent = output.content;
      } catch (error) {
        logger.warn('Lesson quiz AI generation unavailable, falling back to no quiz.', { error, lessonTitle });
        return null;
      }

      const parsed = this.parseQuizResponse(rawContent);
      if (parsed) return parsed;
    }

    logger.warn('Lesson quiz AI generation returned unparseable output twice, falling back to no quiz.', {
      lessonTitle,
    });
    return null;
  }

  private parseQuizResponse(rawText: string): StoredQuizQuestion[] | null {
    try {
      const cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '');
      const data: unknown = JSON.parse(cleaned);
      if (!this.isValidQuizPayload(data)) return null;

      return data.questions.map((question) => {
        const optionIds = question.options.map(() => randomUUID());
        return {
          id: randomUUID(),
          text: question.text,
          options: question.options.map((text, index) => ({ id: optionIds[index] as string, text })),
          correctOptionId: optionIds[question.correctIndex] as string,
        };
      });
    } catch {
      return null;
    }
  }

  private isValidQuizPayload(data: unknown): data is RawQuizPayload {
    if (typeof data !== 'object' || data === null || !('questions' in data)) return false;
    const questions = (data as { questions: unknown }).questions;
    if (!Array.isArray(questions)) return false;
    if (questions.length < LESSON_QUIZ_MIN_QUESTIONS || questions.length > LESSON_QUIZ_MAX_QUESTIONS) return false;

    return questions.every((question) => {
      if (typeof question !== 'object' || question === null) return false;
      const { text, options, correctIndex } = question as Record<string, unknown>;
      return (
        typeof text === 'string' &&
        text.trim().length > 0 &&
        Array.isArray(options) &&
        options.length === LESSON_QUIZ_OPTION_COUNT &&
        options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
        typeof correctIndex === 'number' &&
        Number.isInteger(correctIndex) &&
        correctIndex >= 0 &&
        correctIndex < LESSON_QUIZ_OPTION_COUNT
      );
    });
  }

  private sanitizeQuestions(questions: StoredQuizQuestion[]): SanitizedQuizQuestion[] {
    return questions.map(({ id, text, options }) => ({ id, text, options }));
  }

  /** Shared by every public method — Trainer/Super-Admin always allowed; others need the
   * self-contained lesson-accessibility check (Prompt 5 § SECURITY). */
  private async assertLessonReadable(lessonId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' || actor.role === 'SUPER_ADMIN') {
      const lesson = await this.repository.findLessonById(lessonId);
      if (!lesson) throw new NotFoundError('Lesson not found.');
      return;
    }

    const accessible = await this.repository.isLessonAccessibleToUser(lessonId, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError("You don't have permission to access this lesson's quiz.");
  }
}

export const lessonQuizService = new LessonQuizService();
