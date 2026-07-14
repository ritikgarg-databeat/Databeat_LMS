import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { CreateAnnouncementDto, ListNotificationsQueryDto } from './notifications.dto';
import { notificationsService } from './notifications.service';

// HTTP request handlers for the notifications module. No business logic here — see notifications.service.ts.
export class NotificationsController extends BaseController {
  constructor(protected readonly service = notificationsService) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ListNotificationsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const result = await this.service.list(req.user.id, { unreadOnly: query.unreadOnly === 'true' }, page, pageSize);
    this.ok(res, result);
  };

  unreadCount = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const count = await this.service.unreadCount(req.user.id);
    this.ok(res, { count });
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const notification = await this.service.markRead(req.params.id as string, req.user.id);
    this.ok(res, notification, 'Notification marked as read.');
  };

  markAllRead = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    await this.service.markAllRead(req.user.id);
    this.ok(res, null, 'All notifications marked as read.');
  };

  deleteOne = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.deleteOne(req.params.id as string, req.user.id);
    this.noContent(res);
  };

  createAnnouncement = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.createAnnouncement(req.body as CreateAnnouncementDto, req.user);
    this.created(res, result, 'Announcement sent.');
  };
}
