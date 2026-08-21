import type { Prisma } from '@prisma/client';

/** Content a trainer owns directly or delivers to one of their active groups. */
export function trainerCourseScope(trainerId: string): Prisma.CourseWhereInput {
  return {
    OR: [
      { createdById: trainerId },
      {
        groupAssignments: {
          some: { group: { trainerId, status: 'ACTIVE', deletedAt: null } },
        },
      },
    ],
  };
}

export function trainerAssessmentScope(trainerId: string): Prisma.AssessmentWhereInput {
  return {
    OR: [
      { createdById: trainerId },
      {
        groupAssignments: {
          some: { group: { trainerId, status: 'ACTIVE', deletedAt: null } },
        },
      },
    ],
  };
}
