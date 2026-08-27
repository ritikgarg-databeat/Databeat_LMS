import type { Role } from '@prisma/client';

import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { CreateTimingObservationDto } from './timing-observations.dto';
import {
  TimingObservationsRepository,
  type TimingObservationWithRelations,
} from './timing-observations.repository';
import type {
  TimingObservationListFilters,
  TimingObservationStats,
  TimingObservationView,
  TimingStatSummary,
} from './timing-observations.types';

interface Actor {
  id: string;
  role: Role;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarize(values: number[]): TimingStatSummary {
  if (values.length === 0) return { mean: null, min: null, max: null };
  return { mean: mean(values), min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Business logic for the timing-observations module — the trainer-facing tool for logging a
 * real, self-timed manual-vs-AI-assisted quiz comparison (Measurable Early Impact instrumentation,
 * Task 1). `stats` is always computed live from whatever rows currently match the filters; it
 * never reads from a cache, and reports explicit `null`s (never a placeholder) when `n` is 0.
 */
export class TimingObservationsService extends BaseService {
  constructor(
    protected readonly repository: TimingObservationsRepository = new TimingObservationsRepository(),
  ) {
    super();
  }

  async create(dto: CreateTimingObservationDto, actor: Actor): Promise<TimingObservationView> {
    const course = await this.repository.findCourseById(dto.courseId, actor);
    if (!course) throw new NotFoundError('Course not found.');

    const lesson = await this.repository.findLessonWithCourse(dto.lessonId, actor);
    if (!lesson) throw new NotFoundError('Lesson not found.');
    if (lesson.courseId !== dto.courseId) {
      throw new BadRequestError('This lesson does not belong to the selected course.');
    }

    const created = await this.repository.create({
      trainer: { connect: { id: actor.id } },
      lesson: { connect: { id: dto.lessonId } },
      course: { connect: { id: dto.courseId } },
      manualDurationSeconds: dto.manualDurationSeconds,
      aiAssistedDurationSeconds: dto.aiAssistedDurationSeconds,
      notes: dto.notes,
    });
    return this.toView(created);
  }

  async list(
    filters: TimingObservationListFilters,
    actor: Actor,
    page: number,
    pageSize: number,
  ): Promise<PaginatedData<TimingObservationView>> {
    const scopedFilters = actor.role === 'TRAINER' ? { ...filters, trainerId: actor.id } : filters;
    const { items, total } = await this.repository.findMany(scopedFilters, (page - 1) * pageSize, pageSize);
    return {
      items: items.map((item) => this.toView(item)),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async stats(filters: TimingObservationListFilters, actor: Actor): Promise<TimingObservationStats> {
    const scopedFilters = actor.role === 'TRAINER' ? { ...filters, trainerId: actor.id } : filters;
    const rows = await this.repository.findAllForStats(scopedFilters);

    const manualValues = rows.map((row) => row.manualDurationSeconds);
    const aiValues = rows.map((row) => row.aiAssistedDurationSeconds);
    const savedValues = rows.map((row) => row.manualDurationSeconds - row.aiAssistedDurationSeconds);

    return {
      n: rows.length,
      distinctTrainers: new Set(rows.map((row) => row.trainerId)).size,
      distinctLessons: new Set(rows.map((row) => row.lessonId)).size,
      manual: summarize(manualValues),
      aiAssisted: summarize(aiValues),
      saved: summarize(savedValues),
    };
  }

  private toView(entry: TimingObservationWithRelations): TimingObservationView {
    return {
      id: entry.id,
      trainer: entry.trainer,
      lessonId: entry.lesson.id,
      lessonTitle: entry.lesson.title,
      courseId: entry.course.id,
      courseTitle: entry.course.title,
      manualDurationSeconds: entry.manualDurationSeconds,
      aiAssistedDurationSeconds: entry.aiAssistedDurationSeconds,
      savedSeconds: entry.manualDurationSeconds - entry.aiAssistedDurationSeconds,
      notes: entry.notes,
      createdAt: entry.createdAt,
    };
  }
}
