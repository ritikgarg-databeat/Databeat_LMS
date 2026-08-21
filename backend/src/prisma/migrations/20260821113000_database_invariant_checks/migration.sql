ALTER TABLE "calendar_event_assignments"
  ADD CONSTRAINT "calendar_event_assignments_exactly_one_target_check"
  CHECK (num_nonnulls("departmentId", "groupId", "userId") = 1);

ALTER TABLE "qna_questions"
  ADD CONSTRAINT "qna_questions_visibility_target_check"
  CHECK (
    ("visibility" = 'ORGANIZATION' AND "groupId" IS NULL AND "departmentId" IS NULL)
    OR ("visibility" = 'GROUP' AND "groupId" IS NOT NULL AND "departmentId" IS NULL)
    OR ("visibility" = 'DEPARTMENT' AND "groupId" IS NULL AND "departmentId" IS NOT NULL)
  );

ALTER TABLE "qna_comments"
  ADD CONSTRAINT "qna_comments_exactly_one_parent_check"
  CHECK (num_nonnulls("questionId", "answerId") = 1);
