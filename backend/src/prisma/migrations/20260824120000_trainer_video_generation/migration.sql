CREATE TYPE "VideoGenerationPurpose" AS ENUM ('LESSON_RESOURCE', 'TRAINEE_EXPLANATION');
CREATE TYPE "VideoGenerationStatus" AS ENUM ('PLANNING', 'STORYBOARD_READY', 'QUEUED', 'SYNTHESIZING', 'RENDERING', 'READY', 'PUBLISHED', 'FAILED', 'CANCELLED', 'STALE');
CREATE TYPE "VideoStylePreset" AS ENUM ('CLEAN_CORPORATE', 'VISUAL_EXPLAINER', 'CODE_WALKTHROUGH');

ALTER TYPE "AuditAction" ADD VALUE 'VIDEO_GENERATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'VIDEO_GENERATION_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'VIDEO_GENERATION_PUBLISHED';

CREATE TABLE "video_generation_jobs" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "purpose" "VideoGenerationPurpose" NOT NULL DEFAULT 'LESSON_RESOURCE',
    "status" "VideoGenerationStatus" NOT NULL DEFAULT 'PLANNING',
    "sourceContentVersion" INTEGER NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "selectedResourceIds" JSONB NOT NULL,
    "creativeInstructions" TEXT,
    "targetDurationSeconds" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "style" "VideoStylePreset" NOT NULL,
    "storyboard" JSONB,
    "regenerationSceneIds" JSONB,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "audioArtifacts" JSONB,
    "artifactRelativePath" TEXT,
    "captionRelativePath" TEXT,
    "thumbnailRelativePath" TEXT,
    "artifactMimeType" TEXT,
    "artifactSizeBytes" INTEGER,
    "renderAttempts" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "publishedResourceId" TEXT,
    "publishedContentVersion" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "video_generation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_generation_jobs_publishedResourceId_key" ON "video_generation_jobs"("publishedResourceId");
CREATE INDEX "video_generation_jobs_lessonId_createdAt_idx" ON "video_generation_jobs"("lessonId", "createdAt");
CREATE INDEX "video_generation_jobs_requestedById_status_idx" ON "video_generation_jobs"("requestedById", "status");
CREATE INDEX "video_generation_jobs_status_leaseExpiresAt_createdAt_idx" ON "video_generation_jobs"("status", "leaseExpiresAt", "createdAt");
CREATE INDEX "video_generation_jobs_expiresAt_idx" ON "video_generation_jobs"("expiresAt");
CREATE UNIQUE INDEX "video_generation_jobs_one_active_per_requester_idx"
ON "video_generation_jobs"("requestedById")
WHERE "status" IN ('PLANNING', 'STORYBOARD_READY', 'QUEUED', 'SYNTHESIZING', 'RENDERING', 'READY');

ALTER TABLE "video_generation_jobs" ADD CONSTRAINT "video_generation_jobs_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_generation_jobs" ADD CONSTRAINT "video_generation_jobs_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "video_generation_jobs" ADD CONSTRAINT "video_generation_jobs_publishedResourceId_fkey" FOREIGN KEY ("publishedResourceId") REFERENCES "lesson_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
