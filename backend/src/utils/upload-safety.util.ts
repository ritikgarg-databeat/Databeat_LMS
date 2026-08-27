import fs from 'node:fs/promises';
import path from 'node:path';

import { BadRequestError } from '@/utils/app-error';

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'text/markdown': ['.md', '.markdown'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.csv'],
  'application/zip': ['.zip'],
};

async function readPrefix(file: Express.Multer.File, length = 8192): Promise<Buffer> {
  if (file.buffer) return file.buffer.subarray(0, length);
  if (!file.path) return Buffer.alloc(0);
  const handle = await fs.open(file.path, 'r');
  try {
    const output = Buffer.alloc(Math.min(length, file.size));
    const { bytesRead } = await handle.read(output, 0, output.length, 0);
    return output.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function startsWith(bytes: Buffer, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function isText(bytes: Buffer): boolean {
  if (bytes.includes(0)) return false;
  return !bytes.toString('utf8').includes('\uFFFD');
}

function matchesMagic(bytes: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'application/pdf':
      return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'));
    case 'image/webp':
      return (
        bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'video/mp4':
      return bytes.subarray(4, 8).toString('ascii') === 'ftyp';
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
    case 'application/vnd.ms-excel':
      return isText(bytes);
    default:
      return false;
  }
}

/** Never trust client-provided MIME metadata without checking extension and file bytes. */
export async function assertUploadMatchesDeclaredType(file: Express.Multer.File): Promise<void> {
  const allowedExtensions = MIME_EXTENSIONS[file.mimetype];
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions?.includes(extension)) {
    throw new BadRequestError('The file extension does not match the selected file type.');
  }

  const bytes = await readPrefix(file);
  if (bytes.length === 0 || !matchesMagic(bytes, file.mimetype)) {
    throw new BadRequestError('The file contents do not match the declared file type.');
  }
}

export async function removeTemporaryUpload(file: Express.Multer.File): Promise<void> {
  if (file.path) await fs.rm(file.path, { force: true });
}
