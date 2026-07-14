import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  ListMyCalendarEventsQueryDto,
  UpdateCalendarEventDto,
} from './calendar.dto';
import { CalendarService } from './calendar.service';

// HTTP request handlers for the calendar module. No business logic here — see calendar.service.ts.
export class CalendarController extends BaseController {
  constructor(protected readonly service: CalendarService = new CalendarService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const query = req.query as ListCalendarEventsQueryDto;
    const events = await this.service.list({ from: query.from, to: query.to, type: query.type });
    this.ok(res, events);
  };

  mine = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListMyCalendarEventsQueryDto;
    const events = await this.service.listMine(req.user.id, { from: query.from, to: query.to });
    this.ok(res, events);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const event = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, event);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const event = await this.service.create(req.body as CreateCalendarEventDto, req.user.id, req.ip);
    this.created(res, event, 'Calendar event created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const event = await this.service.update(
      req.params.id as string,
      req.body as UpdateCalendarEventDto,
      req.user.id,
      req.ip,
    );
    this.ok(res, event, 'Calendar event updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.softDelete(req.params.id as string, req.user.id, req.ip);
    this.noContent(res);
  };
}
