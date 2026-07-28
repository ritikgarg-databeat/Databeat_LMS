import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';
import { endOfDayInclusive } from '@/utils/date-range.util';

import type { TimingObservationListFilters } from './timing-observations.types';

const viewInclude = {
  trainer: { select: { id: true, firstName: true, lastName: true } },
  lesson: { select: { id: true, title: true } },
  course: { select: { id: true, title: true } },
} satisfies Prisma.TimingObservationInclude;

export type TimingObservationWithRelations = Prisma.TimingObservationGetPayload<{ include: typeof viewInclude }>;

function buildWhere(filters: TimingObservationListFilters): Prisma.TimingObservationWhereInput {
  const where: Prisma.TimingObservationWhereInput = {};
  if (filters.lessonId) where.lessonId = filters.lessonId;
  if (filters.courseId) where.courseId = filters.courseId;
  if (filters.trainerId) where.trainerId = filters.trainerId;
  if (filters.createdAtFrom || filters.createdAtTo) {
    where.createdAt = {};
    if (filters.createdAtFrom) where.createdAt.gte = new Date(filters.createdAtFrom);
    if (filters.createdAtTo) where.createdAt.lte = endOfDayInclusive(filters.createdAtTo);
  }
  return where;
}

// Data-access layer for the timing-observations module. Only this class may query Prisma
// directly (see ARCHITECTURE.md §3.1).
export class TimingObservationsRepository extends BaseRepository {
  create(data: Prisma.TimingObservationCreateInput): Promise<TimingObservationWithRelations> {
    return this.db.timingObservation.create({ data, include: viewInclude });
  }

  async findMany(
    filters: TimingObservationListFilters,
    skip: number,
    take: number,
  ): Promise<{ items: TimingObservationWithRelations[]; total: number }> {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.timingObservation.findMany({ where, include: viewInclude, orderBy: { createdAt: 'desc' }, skip, take }),
      this.db.timingObservation.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Every row matching the filters, minimal projection — stats are always computed live over the
   * actual current row set (see timing-observations.service.ts#stats), not from a cached/rollup
   * table, so this intentionally has no pagination. This table is trainer-self-reported (one row
   * per manual timing exercise), so its total volume stays small enough that fetching every
   * matching row per stats request is the simplest correct approach.
   */
  findAllForStats(
    filters: TimingObservationListFilters,
  ): Promise<{ trainerId: string; lessonId: string; manualDurationSeconds: number; aiAssistedDurationSeconds: number }[]> {
    const where = buildWhere(filters);
    return this.db.timingObservation.findMany({
      where,
      select: { trainerId: true, lessonId: true, manualDurationSeconds: true, aiAssistedDurationSeconds: true },
    });
  }

  /** Feature-local existence + relationship check: does `lessonId` actually belong to `courseId`? */
  async findLessonWithCourse(lessonId: string): Promise<{ id: string; courseId: string } | null> {
    const lesson = await this.db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, module: { select: { courseId: true } } },
    });
    if (!lesson) return null;
    return { id: lesson.id, courseId: lesson.module.courseId };
  }

  findCourseById(courseId: string) {
    return this.db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  }
}
