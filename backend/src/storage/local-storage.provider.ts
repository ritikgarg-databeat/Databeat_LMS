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

  async save({ buffer, tempPath, originalName, entityType }: SaveFileInput): Promise<StoredFilePointer> {
    if (!ENTITY_TYPE_PATTERN.test(entityType)) {
      throw new Error(`Invalid entityType for file storage: ${entityType}`);
    }

    const filename = generateSafeFilename(originalName);
    const relativePath = path.join(entityType, filename);
    const absolutePath = path.join(this.rootDir, relativePath);

    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
    if (tempPath) {
      try {
        await fsPromises.copyFile(tempPath, absolutePath);
      } finally {
        await fsPromises.rm(tempPath, { force: true });
      }
    } else if (buffer) {
      await fsPromises.writeFile(absolutePath, buffer);
    } else {
      throw new Error('File storage requires either buffer or tempPath.');
    }

    return { relativePath };
  }

  async getReadStream(pointer: StoredFilePointer): Promise<Readable> {
    return fs.createReadStream(this.resolve(pointer));
  }

  async copy(pointer: StoredFilePointer, originalName: string, entityType: string): Promise<StoredFilePointer> {
    if (!ENTITY_TYPE_PATTERN.test(entityType)) throw new Error(`Invalid entityType for file storage: ${entityType}`);
    const relativePath = path.join(entityType, generateSafeFilename(originalName));
    const absolutePath = path.join(this.rootDir, relativePath);
    await fsPromises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsPromises.copyFile(this.resolve(pointer), absolutePath);
    return { relativePath };
  }

  async delete(pointer: StoredFilePointer): Promise<void> {
    await fsPromises.rm(this.resolve(pointer), { force: true });
  }

  async checkHealth(): Promise<void> {
    await fsPromises.mkdir(this.rootDir, { recursive: true });
    await fsPromises.access(this.rootDir, fs.constants.R_OK | fs.constants.W_OK);
  }

  private resolve(pointer: StoredFilePointer): string {
    const resolved = path.resolve(this.rootDir, pointer.relativePath);
    if (resolved !== this.rootDir && !resolved.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new Error('Invalid storage pointer outside the configured upload root.');
    }
    return resolved;
  }
}
