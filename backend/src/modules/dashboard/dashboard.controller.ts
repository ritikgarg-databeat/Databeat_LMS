import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';

import { DashboardService } from './dashboard.service';

// HTTP request handlers for the dashboard module. No business logic here — see dashboard.service.ts.
// Neither route takes query/body input, so there is no `assertValidRequest` call to make (both
// validation chains are empty arrays — see dashboard.validation.ts).
export class DashboardController extends BaseController {
  constructor(protected readonly service: DashboardService = new DashboardService()) {
    super();
  }

  trainee = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const dashboard = await this.service.getTraineeDashboard(req.user);
    this.ok(res, dashboard);
  };

  trainer = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const dashboard = await this.service.getTrainerDashboard(req.user);
    this.ok(res, dashboard);
  };
}
