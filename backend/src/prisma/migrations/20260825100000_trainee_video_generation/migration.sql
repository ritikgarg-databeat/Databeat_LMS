ALTER TABLE "users" ADD COLUMN "traineeVideoDailyLimit" INTEGER;

ALTER TABLE "platform_settings"
ADD COLUMN "traineeVideoDailyLimit" INTEGER NOT NULL DEFAULT 3;

ALTER TYPE "AiFeature" ADD VALUE 'GENERATE_VIDEO';

ALTER TABLE "video_generation_jobs" ADD COLUMN "aiMessageId" TEXT;

CREATE UNIQUE INDEX "video_generation_jobs_aiMessageId_key"
ON "video_generation_jobs"("aiMessageId");

ALTER TABLE "video_generation_jobs"
ADD CONSTRAINT "video_generation_jobs_aiMessageId_fkey"
FOREIGN KEY ("aiMessageId") REFERENCES "ai_messages"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "video_generation_jobs_one_active_per_requester_idx";

CREATE UNIQUE INDEX "video_generation_jobs_one_active_lesson_resource_per_requester_idx"
ON "video_generation_jobs"("requestedById")
WHERE "purpose" = 'LESSON_RESOURCE'
  AND "status" IN ('PLANNING', 'STORYBOARD_READY', 'QUEUED', 'SYNTHESIZING', 'RENDERING', 'READY');

CREATE UNIQUE INDEX "video_generation_jobs_one_processing_trainee_video_per_requester_idx"
ON "video_generation_jobs"("requestedById")
WHERE "purpose" = 'TRAINEE_EXPLANATION'
  AND "status" IN ('PLANNING', 'STORYBOARD_READY', 'QUEUED', 'SYNTHESIZING', 'RENDERING');

ALTER TABLE "users"
ADD CONSTRAINT "users_traineeVideoDailyLimit_check"
CHECK ("traineeVideoDailyLimit" IS NULL OR ("traineeVideoDailyLimit" >= 0 AND "traineeVideoDailyLimit" <= 20));

ALTER TABLE "platform_settings"
ADD CONSTRAINT "platform_settings_traineeVideoDailyLimit_check"
CHECK ("traineeVideoDailyLimit" >= 0 AND "traineeVideoDailyLimit" <= 20);
