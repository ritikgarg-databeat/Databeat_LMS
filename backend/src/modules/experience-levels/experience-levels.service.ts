import { BaseService } from '@/services/base.service';
import { ConflictError, NotFoundError } from '@/utils/app-error';

import type { CreateExperienceLevelDto, UpdateExperienceLevelDto } from './experience-levels.dto';
import { ExperienceLevelsRepository } from './experience-levels.repository';

// Business logic for the experience-levels module. Controllers call into this layer only.
export class ExperienceLevelsService extends BaseService {
  constructor(protected readonly repository: ExperienceLevelsRepository = new ExperienceLevelsRepository()) {
    super();
  }

  /** Used for dropdowns — only ever the active set (Prompt 4 § EXPERIENCE LEVELS). */
  list() {
    return this.repository.findAllActive();
  }

  listAll() {
    return this.repository.findAll();
  }

  /**
   * Adding a level is a plain data insert, never a migration or code change — this is the
   * whole point of the lookup-table design (Prompt 4 § EXPERIENCE LEVELS).
   */
  async create(dto: CreateExperienceLevelDto) {
    const [existingName, existingCode] = await Promise.all([
      this.repository.findByName(dto.name),
      this.repository.findByCode(dto.code),
    ]);
    if (existingName || existingCode) {
      throw new ConflictError('An experience level with this name or code already exists.');
    }

    return this.repository.create({ name: dto.name, code: dto.code });
  }

  async update(id: string, dto: UpdateExperienceLevelDto) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Experience level not found.');

    if (dto.name && dto.name !== existing.name) {
      const nameTaken = await this.repository.findByName(dto.name);
      if (nameTaken) throw new ConflictError('An experience level with this name already exists.');
    }

    return this.repository.update(id, { name: dto.name, isActive: dto.isActive });
  }
}
