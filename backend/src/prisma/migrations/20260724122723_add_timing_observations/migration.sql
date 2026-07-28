-- AlterTable
ALTER TABLE "lesson_quiz_attempts" ADD COLUMN     "generationDurationMs" INTEGER;

-- CreateTable
CREATE TABLE "timing_observations" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "manualDurationSeconds" INTEGER NOT NULL,
    "aiAssistedDurationSeconds" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timing_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timing_observations_lessonId_idx" ON "timing_observations"("lessonId");

-- CreateIndex
CREATE INDEX "timing_observations_trainerId_idx" ON "timing_observations"("trainerId");

-- AddForeignKey
ALTER TABLE "timing_observations" ADD CONSTRAINT "timing_observations_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timing_observations" ADD CONSTRAINT "timing_observations_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timing_observations" ADD CONSTRAINT "timing_observations_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
