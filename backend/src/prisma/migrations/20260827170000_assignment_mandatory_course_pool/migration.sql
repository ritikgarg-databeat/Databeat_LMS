-- Mandatory training is a delivery rule, not a property shared by every trainer using a course.
ALTER TABLE "course_group_assignments"
ADD COLUMN "isMandatory" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the behaviour of all existing course assignments during migration.
UPDATE "course_group_assignments" AS assignment
SET "isMandatory" = course."isMandatory"
FROM "courses" AS course
WHERE course."id" = assignment."courseId";

CREATE INDEX "course_group_assignments_courseId_isMandatory_idx"
ON "course_group_assignments"("courseId", "isMandatory");
