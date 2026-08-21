import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import multer from 'multer';

import { MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';

/**
 * Writes incoming uploads to an OS temporary directory before the validated file is handed to
 * `storageProvider.save()` (see `src/storage/`). Multer never writes to durable application
 * storage itself, keeping the storage abstraction the single place that decides where files live
 * while avoiding whole-file process-memory buffering.
 * Per-field MIME-type allowlists are applied when each module wires this up on its own routes.
 */
const temporaryUploadDirectory = path.join(os.tmpdir(), 'databeat-lms-uploads');
fs.mkdirSync(temporaryUploadDirectory, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: temporaryUploadDirectory,
    filename: (_req, _file, callback) => callback(null, `${Date.now()}-${randomUUID()}.upload`),
  }),
  limits: { fileSize: MAX_LESSON_FILE_SIZE_BYTES },
});
