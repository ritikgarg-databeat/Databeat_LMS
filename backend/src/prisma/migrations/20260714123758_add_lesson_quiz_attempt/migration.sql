-- CreateEnum
CREATE TYPE "LessonQuizAttemptStatus" AS ENUM ('GENERATED', 'SUBMITTED');

-- CreateTable
CREATE TABLE "lesson_quiz_attempts" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LessonQuizAttemptStatus" NOT NULL DEFAULT 'GENERATED',
    "questions" JSONB NOT NULL,
    "selectedAnswers" JSONB,
    "score" INTEGER,
    "totalQuestions" INTEGER NOT NULL,
    "percentage" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "lesson_quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_quiz_attempts_userId_idx" ON "lesson_quiz_attempts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_quiz_attempts_lessonId_userId_key" ON "lesson_quiz_attempts"("lessonId", "userId");

-- AddForeignKey
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_quiz_attempts" ADD CONSTRAINT "lesson_quiz_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
