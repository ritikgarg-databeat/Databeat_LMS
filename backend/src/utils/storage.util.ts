import path from 'node:path';

import { v4 as uuidv4 } from 'uuid';

/**
 * Pure filename/path helpers used by the storage providers in `src/storage/`. Kept separate
 * from the provider abstraction itself so these can be unit tested without a filesystem.
 */
export function getFileExtension(originalName: string): string {
  return path.extname(originalName).toLowerCase();
}

/**
 * Generates a collision-proof filename that never trusts the client's original name for the
 * path itself (see ARCHITECTURE.md §13/§17 — path traversal prevention). The original name's
 * extension is preserved for correct content-type inference on download.
 */
export function generateSafeFilename(originalName: string): string {
  return `${uuidv4()}${getFileExtension(originalName)}`;
}
