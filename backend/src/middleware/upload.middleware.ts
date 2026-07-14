import multer from 'multer';

import { MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';

/**
 * Buffers uploads in memory (not to disk directly) so the buffer can be handed to
 * `storageProvider.save()` (see `src/storage/`) — Multer never writes to a storage backend
 * itself, keeping the storage abstraction the single place that decides where files live.
 * Per-field MIME-type allowlists are applied when each module wires this up on its own routes.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LESSON_FILE_SIZE_BYTES },
});
