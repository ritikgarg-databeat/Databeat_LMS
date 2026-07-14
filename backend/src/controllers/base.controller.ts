import type { Response } from 'express';

import { HTTP_STATUS } from '@/constants/http-status';
import { sendSuccess } from '@/utils/api-response';

/**
 * Base class for module controllers (`src/modules/<name>/<name>.controller.ts`). Wraps the response
 * envelope helpers so handlers write `this.ok(res, data)` instead of importing/calling
 * `sendSuccess` individually — one less import per handler, same envelope everywhere.
 */
export abstract class BaseController {
  protected ok<T>(res: Response, data: T, message?: string) {
    return sendSuccess(res, data, message, HTTP_STATUS.OK);
  }

  protected created<T>(res: Response, data: T, message?: string) {
    return sendSuccess(res, data, message, HTTP_STATUS.CREATED);
  }

  protected noContent(res: Response) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }
}
