import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type { GroupsAnalyticsQueryDto, LeaderboardQueryDto } from './analytics.dto';
import { AnalyticsService } from './analytics.service';

// HTTP request handlers for the analytics module. No business logic here — see analytics.service.ts.
export class AnalyticsController extends BaseController {
  constructor(protected readonly service: AnalyticsService = new AnalyticsService()) {
    super();
  }

  groups = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as GroupsAnalyticsQueryDto;
    const rows = await this.service.getGroupsAnalytics(req.user, { departmentId: query.departmentId });
    // Wrapped in `{items}` to match this standalone endpoint's published response contract —
    // NOT the same shape as `TrainerDashboard.groups`, which embeds the bare array directly.
    this.ok(res, { items: rows });
  };

  groupById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const detail = await this.service.getGroupAnalytics(req.params.id as string, req.user);
    this.ok(res, detail);
  };

  userById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const analytics = await this.service.getUserAnalytics(req.params.id as string, req.user);
    this.ok(res, analytics);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const analytics = await this.service.getMyAnalytics(req.user);
    this.ok(res, analytics);
  };

  leaderboard = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const query = req.query as LeaderboardQueryDto;
    const entries = await this.service.getLeaderboard(
      {
        groupId: query.groupId,
        departmentId: query.departmentId,
        courseId: query.courseId,
        limit: query.limit === undefined ? undefined : Number(query.limit),
      },
      req.user,
    );
    // Wrapped in `{items}` to match this standalone endpoint's published response contract —
    // `dashboard.service.ts` wraps the same service call's bare array the same way.
    this.ok(res, { items: entries });
  };

  courseById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const analytics = await this.service.getCourseAnalytics(req.params.id as string, req.user);
    this.ok(res, analytics);
  };

  assessmentById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const analytics = await this.service.getAssessmentAnalytics(req.params.id as string, req.user);
    this.ok(res, analytics);
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new UnauthorizedError();
    const result = await this.service.refresh(req.user);
    this.ok(res, result, 'Analytics snapshots refreshed successfully.');
  };
}
