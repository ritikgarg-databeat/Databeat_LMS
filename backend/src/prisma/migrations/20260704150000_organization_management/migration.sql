-- Organization Management (Prompt 4): Departments extension, Experience Levels lookup
-- table, Groups, Group Members extension. Hand-authored (not auto-generated) to interleave
-- data backfill between DDL steps — `prisma migrate dev`'s interactive confirmation isn't
-- available in this environment, and the auto-diff can't know how to backfill existing rows.

-- 1. New enums
CREATE TYPE "DepartmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- 2. Extend AuditAction with this phase's new actions
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DEPARTMENT_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_RESTORED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_MEMBER_ADDED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_MEMBER_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_MEMBER_TRANSFERRED';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_BULK_IMPORT';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_TRAINER_ASSIGNED';

-- 3. Experience levels lookup table (created before the users backfill that depends on it)
CREATE TABLE "experience_levels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experience_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "experience_levels_name_key" ON "experience_levels"("name");
CREATE UNIQUE INDEX "experience_levels_code_key" ON "experience_levels"("code");

-- Seed the two levels the old enum already had, so existing user data backfills cleanly.
-- Extending this list later (Prompt 4 § EXPERIENCE LEVELS) is a plain INSERT, no migration.
INSERT INTO "experience_levels" ("id", "name", "code", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Fresher', 'FRESHER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Experienced', 'EXPERIENCED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 4. users.experienceLevel (enum) -> users.experienceLevelId (FK), preserving existing data
ALTER TABLE "users" ADD COLUMN "experienceLevelId" TEXT;

UPDATE "users" u
SET "experienceLevelId" = el."id"
FROM "experience_levels" el
WHERE el."code" = u."experienceLevel"::text;

ALTER TABLE "users" DROP COLUMN "experienceLevel";
DROP TYPE "ExperienceLevel";

CREATE INDEX "users_experienceLevelId_idx" ON "users"("experienceLevelId");
ALTER TABLE "users" ADD CONSTRAINT "users_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "experience_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. departments: add columns nullable first, backfill `code` from `name`, then constrain
ALTER TABLE "departments" ADD COLUMN "code" TEXT;
ALTER TABLE "departments" ADD COLUMN "createdById" TEXT;
ALTER TABLE "departments" ADD COLUMN "description" TEXT;
ALTER TABLE "departments" ADD COLUMN "status" "DepartmentStatus" NOT NULL DEFAULT 'ACTIVE';

UPDATE "departments" SET "code" = upper(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '_', 'g'));

ALTER TABLE "departments" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE INDEX "departments_status_idx" ON "departments"("status");
ALTER TABLE "departments" ADD CONSTRAINT "departments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. groups: no existing rows (confirmed prior to writing this migration), so the new
-- required columns (`code`, non-nullable `departmentId`) can be added directly.
ALTER TABLE "groups" DROP CONSTRAINT "groups_departmentId_fkey";

ALTER TABLE "groups" ADD COLUMN "capacity" INTEGER,
ADD COLUMN "code" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "description" TEXT,
ADD COLUMN "endDate" TIMESTAMP(3),
ADD COLUMN "experienceLevelId" TEXT,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "trainerId" TEXT,
ALTER COLUMN "departmentId" SET NOT NULL;

ALTER TABLE "groups" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "groups_code_key" ON "groups"("code");
CREATE INDEX "groups_experienceLevelId_idx" ON "groups"("experienceLevelId");
CREATE INDEX "groups_trainerId_idx" ON "groups"("trainerId");
CREATE INDEX "groups_status_idx" ON "groups"("status");
CREATE INDEX "groups_deletedAt_idx" ON "groups"("deletedAt");

ALTER TABLE "groups" ADD CONSTRAINT "groups_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_experienceLevelId_fkey" FOREIGN KEY ("experienceLevelId") REFERENCES "experience_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. group_members: track who added each member
ALTER TABLE "group_members" ADD COLUMN "addedById" TEXT;
CREATE INDEX "group_members_userId_idx" ON "group_members"("userId");
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
