import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

import { env } from '@/config/env';
import { generateSafeFilename } from '@/utils/storage.util';

import type { SaveFileInput, StorageProvider, StoredFilePointer } from './storage-provider.interface';

const ENTITY_TYPE_PATTERN = /^[a-z0-9-]+$/;

/**
 * Launch implementation of `StorageProvider`: writes to disk under `UPLOAD_PATH`.
 * `entityType` is validated against an allowlist pattern (not the client's raw input path)
 * to prevent path traversal — see ARCHITECTURE.md §13/§17.
 */
export class LocalStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor(rootDir: string = env.UPLOAD_PATH) {
    this.rootDir = path.resolve(rootDir);
  }

  async save({ buffer, originalName, entityType }: SaveFileInput): Promise<StoredFilePointer> {
    if (!ENTITY_TYPE_PATTERN.test(entityType)) {
      throw new Error(`Invalid entityType for file storage: ${entityType}`);
    }

    const filename = generateSafeFilename(originalName);
    const relativePath = path.join(entityType, filename);
    const absolutePath = path.join(this.rootDir, relativePath);

    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsPromises.writeFile(absolutePath, buffer);

    return { relativePath };
  }

  async getReadStream(pointer: StoredFilePointer): Promise<Readable> {
    return fs.createReadStream(this.resolve(pointer));
  }

  async delete(pointer: StoredFilePointer): Promise<void> {
    await fsPromises.rm(this.resolve(pointer), { force: true });
  }

  private resolve(pointer: StoredFilePointer): string {
    return path.join(this.rootDir, pointer.relativePath);
  }
}
