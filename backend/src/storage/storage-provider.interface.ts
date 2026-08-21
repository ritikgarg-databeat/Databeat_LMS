import type { Readable } from 'node:stream';

export interface StoredFilePointer {
  /** Path relative to the storage root — the only thing ever persisted to the database. */
  relativePath: string;
}

export interface SaveFileInput {
  /** Small uploads may be buffered; large uploads should use a disk-backed temporary path. */
  buffer?: Buffer;
  tempPath?: string;
  originalName: string;
  /** Namespaces files by owning entity, e.g. "lesson-resources", "avatars". */
  entityType: string;
}

/**
 * Storage abstraction (ARCHITECTURE.md §13). Application code must depend on this interface,
 * never on `fs` or a specific vendor SDK directly — that is what lets local disk be swapped
 * for S3/R2/Azure/GCS later without touching any module's service/controller code.
 */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<StoredFilePointer>;
  copy(pointer: StoredFilePointer, originalName: string, entityType: string): Promise<StoredFilePointer>;
  getReadStream(pointer: StoredFilePointer): Promise<Readable>;
  delete(pointer: StoredFilePointer): Promise<void>;
  checkHealth(): Promise<void>;
}
