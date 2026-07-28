import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateTimingObservationDto, ListTimingObservationsQueryDto, StatsTimingObservationsQueryDto } from './timing-observations.dto';
import { TimingObservationsService } from './timing-observations.service';
import type { TimingObservationListFilters } from './timing-observations.types';

function toFilters(query: ListTimingObservationsQueryDto | StatsTimingObservationsQueryDto): TimingObservationListFilters {
  return {
    lessonId: query.lessonId,
    courseId: query.courseId,
    trainerId: query.trainerId,
    createdAtFrom: query.createdAtFrom,
    createdAtTo: query.createdAtTo,
  };
}

// HTTP request handlers for the timing-observations module. No business logic here — see
// timing-observations.service.ts. Mounted at `/timing-observations` in src/routes/index.ts.
export class TimingObservationsController extends BaseController {
  constructor(protected readonly service: TimingObservationsService = new TimingObservationsService()) {
    super();
  }

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const observation = await this.service.create(req.body as CreateTimingObservationDto, req.user);
    this.created(res, observation, 'Timing observation logged.');
  };

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as ListTimingObservationsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);
    const result = await this.service.list(toFilters(query), page, pageSize);
    this.ok(res, result);
  };

  stats = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();

    const query = req.query as StatsTimingObservationsQueryDto;
    const stats = await this.service.stats(toFilters(query));
    this.ok(res, stats);
  };
}
