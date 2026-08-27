ALTER TYPE "AssessmentSubmissionReason" ADD VALUE IF NOT EXISTS 'INTEGRITY_VIOLATION';

DO $$ BEGIN
  CREATE TYPE "AssessmentIntegrityEventType" AS ENUM (
    'FULLSCREEN_EXIT',
    'TAB_HIDDEN',
    'WINDOW_BLUR',
    'SCREENSHOT_ATTEMPT',
    'PRINT_ATTEMPT',
    'COPY_ATTEMPT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "courses"
ADD COLUMN IF NOT EXISTS "isMandatory" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "lesson_resources"
ADD COLUMN IF NOT EXISTS "contentVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "assessment_attempts"
ADD COLUMN IF NOT EXISTS "integrityViolationCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "lesson_resource_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "status" "LessonProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "completedContentVersion" INTEGER,
  "activeTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  "furthestVideoSecond" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "videoDurationSeconds" DOUBLE PRECISION,
  "watchedIntervals" JSONB,
  "maxScrollPercentage" INTEGER NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastEventAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lesson_resource_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_resource_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_resource_progress_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "lesson_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "lesson_resource_progress_userId_resourceId_key"
ON "lesson_resource_progress"("userId", "resourceId");
CREATE INDEX "lesson_resource_progress_userId_idx" ON "lesson_resource_progress"("userId");
CREATE INDEX "lesson_resource_progress_resourceId_idx" ON "lesson_resource_progress"("resourceId");

CREATE TABLE "assessment_integrity_events" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "AssessmentIntegrityEventType" NOT NULL,
  "countsAsViolation" BOOLEAN NOT NULL DEFAULT true,
  "clientOccurredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_integrity_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assessment_integrity_events_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assessment_integrity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "assessment_integrity_events_attemptId_createdAt_idx"
ON "assessment_integrity_events"("attemptId", "createdAt");
CREATE INDEX "assessment_integrity_events_userId_createdAt_idx"
ON "assessment_integrity_events"("userId", "createdAt");
