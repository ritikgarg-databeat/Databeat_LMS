import { pipeline } from 'node:stream/promises';

import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { assertValidRequest } from '@/utils/validation.util';

import type { UpdateNotificationPreferencesDto, UpdatePlatformSettingsDto, UpdateThemeDto } from './settings.dto';
import type { SettingsService } from './settings.service';
import { settingsService } from './settings.service';

// HTTP request handlers for the settings module. No business logic here — see settings.service.ts.
// Every handler here reads `req.user.id` for the acting user — this module never accepts a
// target user id in the request, every route operates on the caller's own settings.
export class SettingsController extends BaseController {
  // Defaults to the shared `settingsService` singleton, NOT a fresh `new SettingsService()` — the
  // service now holds real in-memory state (`isMaintenanceModeActive()`'s cache), and
  // `updatePlatformSettings` invalidates that cache on ITS OWN instance. A separate instance here
  // would invalidate a cache nothing ever reads, while `auth.middleware.ts`/`auth.service.ts`
  // (which import the same singleton) would keep serving a stale value for up to the full cache
  // TTL after every toggle — confirmed live: without this, a maintenance-mode toggle took up to
  // 5 seconds to actually take effect instead of the "near-immediate" the cache was designed for.
  constructor(protected readonly service: SettingsService = settingsService) {
    super();
  }

  getSummary = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const summary = await this.service.getSummary(req.user.id);
    this.ok(res, summary);
  };

  updateTheme = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const { theme } = req.body as UpdateThemeDto;
    const result = await this.service.updateTheme(req.user.id, theme);
    this.ok(res, result);
  };

  getNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.getNotificationPreferences(req.user.id);
    this.ok(res, result);
  };

  updateNotificationPreferences = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const { mutedTypes } = req.body as UpdateNotificationPreferencesDto;
    const result = await this.service.updateNotificationPreferences(req.user.id, mutedTypes ?? []);
    this.ok(res, result);
  };

  uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    if (!req.file) throw new BadRequestError('A file is required.');
    const result = await this.service.uploadAvatar(req.user.id, req.file);
    this.created(res, result, 'Avatar uploaded successfully.');
  };

  removeAvatar = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.removeAvatar(req.user.id);
    this.noContent(res);
  };

  downloadAvatar = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const { stream, mimeType } = await this.service.getAvatarStream(req.user.id);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');

    try {
      // `pipeline` (not a bare `stream.pipe(res)`) turns a read-stream error into a rejected
      // promise instead of an unhandled 'error' event — mirrors resources.controller.ts#download.
      await pipeline(stream, res);
    } catch (error) {
      if (res.headersSent) {
        logger.error('Avatar stream failed mid-response', { error, userId: req.user.id });
        res.destroy();
        return;
      }
      throw new NotFoundError('The requested file could not be found.');
    }
  };

  getPlatformSettings = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.getPlatformSettings();
    this.ok(res, result);
  };

  updatePlatformSettings = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.updatePlatformSettings(req.body as UpdatePlatformSettingsDto, req.user.id);
    this.ok(res, result);
  };
}
