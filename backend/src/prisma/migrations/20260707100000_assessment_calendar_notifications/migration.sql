
-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('PYTHON', 'SQL', 'STATISTICS', 'DATA_ANALYTICS', 'MACHINE_LEARNING', 'POWER_BI', 'EXCEL', 'SPARK', 'HADOOP', 'GENERAL');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CORRECT_MCQ', 'MULTIPLE_CORRECT', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER', 'LONG_ANSWER', 'SQL_QUERY', 'CODE_SNIPPET', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'PENDING_REVIEW', 'GRADED');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CLASS', 'LIVE_SESSION', 'ASSESSMENT', 'DEADLINE', 'HOLIDAY', 'MEETING', 'REMINDER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSESSMENT_ASSIGNED', 'ASSESSMENT_DEADLINE_APPROACHING', 'CALENDAR_EVENT_CREATED', 'CALENDAR_EVENT_UPDATED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QUESTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'QUESTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'QUESTION_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'QUESTION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_ASSIGNED_TO_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_UNASSIGNED_FROM_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_QUESTION_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_QUESTION_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_QUESTIONS_REORDERED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_ATTEMPT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSESSMENT_ANSWER_GRADED';
ALTER TYPE "AuditAction" ADD VALUE 'CALENDAR_EVENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'CALENDAR_EVENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'CALENDAR_EVENT_DELETED';

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "category" "QuestionCategory" NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "explanation" TEXT,
    "correctAnswers" JSONB,
    "starterCode" TEXT,
    "language" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "passingPercentage" INTEGER NOT NULL,
    "availableFrom" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "instructions" TEXT,
    "negativeMarkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "negativeMarksPerWrongAnswer" DOUBLE PRECISION,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
    "showResultImmediately" BOOLEAN NOT NULL DEFAULT true,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT,
    "order" INTEGER NOT NULL,
    "marks" INTEGER NOT NULL,
    "snapshotTitle" TEXT NOT NULL,
    "snapshotType" "QuestionType" NOT NULL,
    "snapshotExplanation" TEXT,
    "snapshotOptions" JSONB,
    "snapshotCorrectAnswers" JSONB,
    "snapshotStarterCode" TEXT,
    "snapshotLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_group_assignments" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_group_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AssessmentAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionOrder" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "assessmentQuestionId" TEXT NOT NULL,
    "selectedOptionIds" JSONB,
    "textAnswer" TEXT,
    "fileRelativePath" TEXT,
    "fileOriginalFilename" TEXT,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event_assignments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "departmentId" TEXT,
    "groupId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_category_idx" ON "questions"("category");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- CreateIndex
CREATE INDEX "questions_type_idx" ON "questions"("type");

-- CreateIndex
CREATE INDEX "questions_status_idx" ON "questions"("status");

-- CreateIndex
CREATE INDEX "questions_deletedAt_idx" ON "questions"("deletedAt");

-- CreateIndex
CREATE INDEX "question_options_questionId_idx" ON "question_options"("questionId");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_deletedAt_idx" ON "assessments"("deletedAt");

-- CreateIndex
CREATE INDEX "assessment_questions_assessmentId_idx" ON "assessment_questions"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_questions_questionId_idx" ON "assessment_questions"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_questions_assessmentId_order_key" ON "assessment_questions"("assessmentId", "order");

-- CreateIndex
CREATE INDEX "assessment_group_assignments_assessmentId_idx" ON "assessment_group_assignments"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_group_assignments_groupId_idx" ON "assessment_group_assignments"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_group_assignments_assessmentId_groupId_key" ON "assessment_group_assignments"("assessmentId", "groupId");

-- CreateIndex
CREATE INDEX "assessment_attempts_assessmentId_idx" ON "assessment_attempts"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_attempts_userId_idx" ON "assessment_attempts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_assessmentId_userId_key" ON "assessment_attempts"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "assessment_answers_attemptId_idx" ON "assessment_answers"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_answers_attemptId_assessmentQuestionId_key" ON "assessment_answers"("attemptId", "assessmentQuestionId");

-- CreateIndex
CREATE INDEX "calendar_events_startAt_idx" ON "calendar_events"("startAt");

-- CreateIndex
CREATE INDEX "calendar_events_type_idx" ON "calendar_events"("type");

-- CreateIndex
CREATE INDEX "calendar_events_deletedAt_idx" ON "calendar_events"("deletedAt");

-- CreateIndex
CREATE INDEX "calendar_event_assignments_eventId_idx" ON "calendar_event_assignments"("eventId");

-- CreateIndex
CREATE INDEX "calendar_event_assignments_departmentId_idx" ON "calendar_event_assignments"("departmentId");

-- CreateIndex
CREATE INDEX "calendar_event_assignments_groupId_idx" ON "calendar_event_assignments"("groupId");

-- CreateIndex
CREATE INDEX "calendar_event_assignments_userId_idx" ON "calendar_event_assignments"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_group_assignments" ADD CONSTRAINT "assessment_group_assignments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_group_assignments" ADD CONSTRAINT "assessment_group_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_group_assignments" ADD CONSTRAINT "assessment_group_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_assessmentQuestionId_fkey" FOREIGN KEY ("assessmentQuestionId") REFERENCES "assessment_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignments" ADD CONSTRAINT "calendar_event_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignments" ADD CONSTRAINT "calendar_event_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignments" ADD CONSTRAINT "calendar_event_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_assignments" ADD CONSTRAINT "calendar_event_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

