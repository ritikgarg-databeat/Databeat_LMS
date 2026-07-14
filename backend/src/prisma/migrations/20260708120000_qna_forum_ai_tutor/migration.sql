-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('CHAT', 'EXPLAIN_TOPIC', 'SUMMARIZE_LESSON', 'GENERATE_EXAMPLES', 'GENERATE_PRACTICE_QUESTIONS');

-- CreateEnum
CREATE TYPE "AiExplanationLevel" AS ENUM ('BEGINNER', 'DETAILED', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "QnaVisibility" AS ENUM ('GROUP', 'DEPARTMENT', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "QnaQuestionStatus" AS ENUM ('OPEN', 'SOLVED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'QNA_QUESTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_QUESTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_QUESTION_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_QUESTION_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_ANSWER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_ANSWER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_ANSWER_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_ANSWER_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'QNA_ANSWER_PINNED';
ALTER TYPE "AuditAction" ADD VALUE 'AI_CONVERSATION_DELETED';

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "feature" "AiFeature",
    "content" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qna_questions" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "courseId" TEXT,
    "moduleId" TEXT,
    "lessonId" TEXT,
    "visibility" "QnaVisibility" NOT NULL,
    "groupId" TEXT,
    "departmentId" TEXT,
    "status" "QnaQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "qna_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qna_answers" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "qna_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qna_comments" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "answerId" TEXT,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qna_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qna_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "answerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qna_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qna_tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qna_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qna_question_tags" (
    "questionId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "qna_question_tags_pkey" PRIMARY KEY ("questionId","tagId")
);

-- CreateTable
CREATE TABLE "qna_attachments" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "answerId" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qna_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_conversations_lessonId_idx" ON "ai_conversations"("lessonId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "qna_questions_authorId_idx" ON "qna_questions"("authorId");

-- CreateIndex
CREATE INDEX "qna_questions_status_deletedAt_idx" ON "qna_questions"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "qna_questions_groupId_idx" ON "qna_questions"("groupId");

-- CreateIndex
CREATE INDEX "qna_questions_departmentId_idx" ON "qna_questions"("departmentId");

-- CreateIndex
CREATE INDEX "qna_questions_courseId_idx" ON "qna_questions"("courseId");

-- CreateIndex
CREATE INDEX "qna_questions_moduleId_idx" ON "qna_questions"("moduleId");

-- CreateIndex
CREATE INDEX "qna_questions_lessonId_idx" ON "qna_questions"("lessonId");

-- CreateIndex
CREATE INDEX "qna_questions_createdAt_idx" ON "qna_questions"("createdAt");

-- CreateIndex
CREATE INDEX "qna_answers_questionId_idx" ON "qna_answers"("questionId");

-- CreateIndex
CREATE INDEX "qna_answers_authorId_idx" ON "qna_answers"("authorId");

-- CreateIndex
CREATE INDEX "qna_comments_questionId_idx" ON "qna_comments"("questionId");

-- CreateIndex
CREATE INDEX "qna_comments_answerId_idx" ON "qna_comments"("answerId");

-- CreateIndex
CREATE INDEX "qna_votes_questionId_idx" ON "qna_votes"("questionId");

-- CreateIndex
CREATE INDEX "qna_votes_answerId_idx" ON "qna_votes"("answerId");

-- CreateIndex
CREATE INDEX "qna_votes_userId_idx" ON "qna_votes"("userId");

-- Hand-added (not emitted by `prisma migrate diff` — Prisma's schema.prisma syntax cannot
-- express a partial unique index). Without the WHERE clause, Postgres treats every NULL as
-- distinct, so a plain UNIQUE("userId","questionId") would never actually stop a user from
-- voting on the same answer twice (every such row has questionId = NULL). See the QnaVote
-- doc-comment in schema.prisma for the full rationale.
-- CreateIndex
CREATE UNIQUE INDEX "qna_votes_userId_questionId_key" ON "qna_votes"("userId", "questionId") WHERE "questionId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "qna_votes_userId_answerId_key" ON "qna_votes"("userId", "answerId") WHERE "answerId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "qna_tags_name_key" ON "qna_tags"("name");

-- CreateIndex
CREATE INDEX "qna_question_tags_tagId_idx" ON "qna_question_tags"("tagId");

-- CreateIndex
CREATE INDEX "qna_attachments_questionId_idx" ON "qna_attachments"("questionId");

-- CreateIndex
CREATE INDEX "qna_attachments_answerId_idx" ON "qna_attachments"("answerId");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_questions" ADD CONSTRAINT "qna_questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_questions" ADD CONSTRAINT "qna_questions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_questions" ADD CONSTRAINT "qna_questions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_questions" ADD CONSTRAINT "qna_questions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_questions" ADD CONSTRAINT "qna_questions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_questions" ADD CONSTRAINT "qna_questions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_answers" ADD CONSTRAINT "qna_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "qna_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_answers" ADD CONSTRAINT "qna_answers_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_answers" ADD CONSTRAINT "qna_answers_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_comments" ADD CONSTRAINT "qna_comments_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "qna_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_comments" ADD CONSTRAINT "qna_comments_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "qna_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_comments" ADD CONSTRAINT "qna_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_votes" ADD CONSTRAINT "qna_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_votes" ADD CONSTRAINT "qna_votes_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "qna_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_votes" ADD CONSTRAINT "qna_votes_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "qna_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_question_tags" ADD CONSTRAINT "qna_question_tags_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "qna_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_question_tags" ADD CONSTRAINT "qna_question_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "qna_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_attachments" ADD CONSTRAINT "qna_attachments_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "qna_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_attachments" ADD CONSTRAINT "qna_attachments_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "qna_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qna_attachments" ADD CONSTRAINT "qna_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
