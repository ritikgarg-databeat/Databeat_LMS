import { disconnectDatabase, prisma } from '@/config/prisma';

interface CountRow {
  count: bigint;
}

async function main(): Promise<void> {
  const calendarRows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "calendar_event_assignments"
    WHERE num_nonnulls("departmentId", "groupId", "userId") <> 1
  `;
  const qnaVisibilityRows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "qna_questions"
    WHERE NOT (
      ("visibility" = 'ORGANIZATION' AND "groupId" IS NULL AND "departmentId" IS NULL)
      OR ("visibility" = 'GROUP' AND "groupId" IS NOT NULL AND "departmentId" IS NULL)
      OR ("visibility" = 'DEPARTMENT' AND "groupId" IS NULL AND "departmentId" IS NOT NULL)
    )
  `;
  const qnaCommentRows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "qna_comments"
    WHERE num_nonnulls("questionId", "answerId") <> 1
  `;

  const result = {
    calendarInvalid: Number(calendarRows[0]?.count ?? 0n),
    qnaVisibilityInvalid: Number(qnaVisibilityRows[0]?.count ?? 0n),
    qnaCommentInvalid: Number(qnaCommentRows[0]?.count ?? 0n),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (Object.values(result).some((value) => value > 0)) process.exitCode = 1;
}

void main().finally(() => disconnectDatabase());
