import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateExperienceLevelDto, UpdateExperienceLevelDto } from './experience-levels.dto';
import { ExperienceLevelsService } from './experience-levels.service';

// HTTP request handlers for the experience-levels module. No business logic here.
export class ExperienceLevelsController extends BaseController {
  constructor(protected readonly service: ExperienceLevelsService = new ExperienceLevelsService()) {
    super();
  }

  list = async (_req: Request, res: Response): Promise<void> => {
    const levels = await this.service.list();
    this.ok(res, levels);
  };

  listAll = async (_req: Request, res: Response): Promise<void> => {
    const levels = await this.service.listAll();
    this.ok(res, levels);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const level = await this.service.create(req.body as CreateExperienceLevelDto);
    this.created(res, level, 'Experience level created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const level = await this.service.update(req.params.id as string, req.body as UpdateExperienceLevelDto);
    this.ok(res, level, 'Experience level updated successfully.');
  };
}
