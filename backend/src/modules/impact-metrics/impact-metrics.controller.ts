import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { DateRangeQueryDto, ImpactReportQueryDto, PilotDashboardQueryDto } from './impact-metrics.dto';
import { ImpactMetricsService } from './impact-metrics.service';

// HTTP request handlers for the impact-metrics module. No business logic here — see
// impact-metrics.service.ts. Mounted at `/impact-metrics` in src/routes/index.ts.
export class ImpactMetricsController extends BaseController {
  constructor(protected readonly service: ImpactMetricsService = new ImpactMetricsService()) {
    super();
  }

  autoGradingLatency = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const query = req.query as DateRangeQueryDto;
    this.ok(res, await this.service.getAutoGradingLatencyReport(query));
  };

  aiQuizGenLatency = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const query = req.query as DateRangeQueryDto;
    this.ok(res, await this.service.getAiQuizGenLatencyReport(query));
  };

  csvImportSpeed = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    const query = req.query as DateRangeQueryDto;
    this.ok(res, await this.service.getCsvImportSpeedReport(query));
  };

  pilotDashboard = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as unknown as PilotDashboardQueryDto;
    this.ok(res, await this.service.getPilotDashboard(query, req.user));
  };

  impactReport = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ImpactReportQueryDto;
    this.ok(res, await this.service.generateImpactReport(query, req.user));
  };
}
