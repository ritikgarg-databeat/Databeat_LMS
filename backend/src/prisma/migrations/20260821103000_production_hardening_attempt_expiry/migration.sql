-- Server-authoritative assessment expiry and submission provenance.
CREATE TYPE "AssessmentSubmissionReason" AS ENUM ('LEARNER', 'TIME_EXPIRED', 'DUE_DATE_REACHED', 'ADMIN');

ALTER TABLE "assessment_attempts"
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "submissionReason" "AssessmentSubmissionReason";

-- Backfill existing attempts from the configuration that existed at migration time. The expiry
-- is the earlier of startedAt + duration and dueDate (when present).
UPDATE "assessment_attempts" AS attempt
SET "expiresAt" = LEAST(
  attempt."startedAt" + (assessment."durationMinutes" * INTERVAL '1 minute'),
  COALESCE(assessment."dueDate", 'infinity'::timestamp)
)
FROM "assessments" AS assessment
WHERE assessment."id" = attempt."assessmentId";

ALTER TABLE "assessment_attempts"
ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "assessment_attempts_expiresAt_idx" ON "assessment_attempts"("expiresAt");
