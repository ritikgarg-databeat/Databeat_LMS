import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { UnauthorizedError } from '@/utils/app-error';
import { assertValidRequest } from '@/utils/validation.util';

import type {
  CreateModuleDto,
  ListModulesQueryDto,
  ReorderModulesDto,
  UpdateModuleDto,
  UpdateModuleStatusDto,
} from './modules.dto';
import { ModulesService } from './modules.service';

// HTTP request handlers for the modules module. No business logic here — see modules.service.ts.
export class ModulesController extends BaseController {
  constructor(protected readonly service: ModulesService = new ModulesService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const { courseId } = req.query as unknown as ListModulesQueryDto;
    const modules = await this.service.list(courseId, req.user);
    this.ok(res, modules);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const module = await this.service.getById(req.params.id as string, req.user);
    this.ok(res, module);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const module = await this.service.create(req.body as CreateModuleDto, req.user, req.ip);
    this.created(res, module, 'Module created successfully.');
  };

  update = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const module = await this.service.update(
      req.params.id as string,
      req.body as UpdateModuleDto,
      req.user,
      req.ip,
    );
    this.ok(res, module, 'Module updated successfully.');
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    const module = await this.service.updateStatus(
      req.params.id as string,
      req.body as UpdateModuleStatusDto,
      req.user,
      req.ip,
    );
    this.ok(res, module, 'Module status updated successfully.');
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.remove(req.params.id as string, req.user, req.ip);
    this.noContent(res);
  };

  reorder = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);
    if (!req.user) throw new UnauthorizedError();
    await this.service.reorder(req.body as ReorderModulesDto, req.user, req.ip);
    this.ok(res, null, 'Modules reordered successfully.');
  };
}
