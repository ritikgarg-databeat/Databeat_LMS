import type { Prisma } from '@prisma/client';

/** Master course content a trainer is allowed to change. */
export function trainerCourseScope(trainerId: string): Prisma.CourseWhereInput {
  return { createdById: trainerId };
}

/** Shared catalogue content a trainer is allowed to view or reuse. */
export function trainerCourseCatalogScope(trainerId: string): Prisma.CourseWhereInput {
  return { OR: [{ createdById: trainerId }, { status: 'PUBLISHED' }] };
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
