import type { Request, Response } from 'express';

import { HTTP_STATUS } from '@/constants/http-status';
import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { ProgressExportQueryDto, ResultsExportQueryDto } from './reports.dto';
import { ReportsService } from './reports.service';
import type { CsvExport } from './reports.types';

/**
 * HTTP request handlers for the reports module. No business logic here — see reports.service.ts.
 * Mounted under `/api/v1/reports` with `authenticate` + `requireRole(TRAINER, SUPER_ADMIN)`
 * already run (see reports.routes.ts), so `req.user` is always a staff user by the time any
 * handler executes.
 */
export class ReportsController extends BaseController {
  constructor(protected readonly service: ReportsService = new ReportsService()) {
    super();
  }

  exportProgress = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ProgressExportQueryDto;
    this.sendCsv(res, await this.service.exportProgress(req.user, query));
  };

  exportResults = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as ResultsExportQueryDto;
    this.sendCsv(res, await this.service.exportResults(req.user, query));
  };

  exportGroups = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    this.sendCsv(res, await this.service.exportGroups(req.user));
  };

  exportCourses = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    this.sendCsv(res, await this.service.exportCourses(req.user));
  };

  /**
   * CSV downloads deliberately bypass the JSON success envelope — the body is a file, not an
   * API payload. Filename sanitization uses the same pattern as resources.controller.ts#download
   * (quotes, backslashes and CR/LF stripped so the Content-Disposition header can't be broken
   * out of); `csvFilename` already restricts output to `[a-z0-9-]`, making this belt-and-braces.
   */
  private sendCsv(res: Response, exportResult: CsvExport): void {
    const safeFilename = exportResult.filename.replace(/["\\\r\n]/g, '');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.status(HTTP_STATUS.OK).send(exportResult.csv);
  }
}
