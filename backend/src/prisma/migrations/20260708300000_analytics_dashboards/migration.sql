-- CreateEnum
CREATE TYPE "AnalyticsInsightScope" AS ENUM ('USER', 'GROUP');

-- CreateEnum
CREATE TYPE "AnalyticsInsightSource" AS ENUM ('AI', 'HEURISTIC');

-- CreateTable
CREATE TABLE "user_daily_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "logins" INTEGER NOT NULL DEFAULT 0,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "assessmentsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "aiMessages" INTEGER NOT NULL DEFAULT 0,
    "qnaPosts" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_daily_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_performance_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coursesAssigned" INTEGER NOT NULL DEFAULT 0,
    "coursesCompleted" INTEGER NOT NULL DEFAULT 0,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalAssignedLessons" INTEGER NOT NULL DEFAULT 0,
    "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "assessmentsAssigned" INTEGER NOT NULL DEFAULT 0,
    "assessmentsTaken" INTEGER NOT NULL DEFAULT 0,
    "assessmentsPassed" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION,
    "activityEvents7d" INTEGER NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_performance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_analytics_snapshots" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "assignedTrainees" INTEGER NOT NULL DEFAULT 0,
    "startedCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageTimeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION,
    "lessonFunnel" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_analytics_snapshots" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "assignedTrainees" INTEGER NOT NULL DEFAULT 0,
    "attemptedCount" INTEGER NOT NULL DEFAULT 0,
    "submittedCount" INTEGER NOT NULL DEFAULT 0,
    "gradedCount" INTEGER NOT NULL DEFAULT 0,
    "participationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION,
    "passRate" DOUBLE PRECISION,
    "questionStats" JSONB,
    "weakTopics" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_insights" (
    "id" TEXT NOT NULL,
    "scopeType" "AnalyticsInsightScope" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "insights" JSONB NOT NULL,
    "source" "AnalyticsInsightSource" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_daily_activity_date_idx" ON "user_daily_activity"("date");

-- CreateIndex
CREATE UNIQUE INDEX "user_daily_activity_userId_date_key" ON "user_daily_activity"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "user_performance_snapshots_userId_key" ON "user_performance_snapshots"("userId");

-- CreateIndex
CREATE INDEX "user_performance_snapshots_performanceScore_idx" ON "user_performance_snapshots"("performanceScore");

-- CreateIndex
CREATE UNIQUE INDEX "course_analytics_snapshots_courseId_key" ON "course_analytics_snapshots"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_analytics_snapshots_assessmentId_key" ON "assessment_analytics_snapshots"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_insights_scopeType_scopeId_key" ON "analytics_insights"("scopeType", "scopeId");

-- AddForeignKey
ALTER TABLE "user_daily_activity" ADD CONSTRAINT "user_daily_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_performance_snapshots" ADD CONSTRAINT "user_performance_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_analytics_snapshots" ADD CONSTRAINT "course_analytics_snapshots_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_analytics_snapshots" ADD CONSTRAINT "assessment_analytics_snapshots_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

