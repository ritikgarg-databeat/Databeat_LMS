import { BaseService } from '@/services/base.service';

import { QnaTagsRepository } from './qna-tags.repository';
import type { TagListFilters, TagListItem } from './qna-tags.types';

// Business logic for the qna-tags module. Controllers call into this layer only.
export class QnaTagsService extends BaseService {
  constructor(protected readonly repository: QnaTagsRepository = new QnaTagsRepository()) {
    super();
  }

  async list(filters: TagListFilters): Promise<TagListItem[]> {
    const tags = await this.repository.findMany(filters);
    return tags.map((tag) => ({ id: tag.id, name: tag.name, questionCount: tag._count.questions }));
  }
}
