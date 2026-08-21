ALTER TABLE "lessons"
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "lesson_progress"
ADD COLUMN "completedContentVersion" INTEGER;

UPDATE "lesson_progress" AS progress
SET "completedContentVersion" = lesson."contentVersion"
FROM "lessons" AS lesson
WHERE progress."lessonId" = lesson."id"
  AND progress."status" = 'COMPLETED';

ALTER TABLE "lesson_quiz_attempts"
ADD COLUMN "contentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "lesson_quiz_attempts_lessonId_userId_key";

CREATE UNIQUE INDEX "lesson_quiz_attempts_lessonId_userId_contentVersion_attemptNumber_key"
ON "lesson_quiz_attempts"("lessonId", "userId", "contentVersion", "attemptNumber");

CREATE INDEX "lesson_quiz_attempts_lessonId_userId_contentVersion_idx"
ON "lesson_quiz_attempts"("lessonId", "userId", "contentVersion");
