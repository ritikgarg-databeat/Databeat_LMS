import { buffer as readStreamToBuffer } from 'node:stream/consumers';

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { logger } from '@/utils/logger';

const PPTX_TEXT_TAG_PATTERN = /<a:t>([^<]*)<\/a:t>/g;

/** File types whose textual contents can be used as grounded lesson material. */
export const EXTRACTABLE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/**
 * Best-effort text extraction shared by the lesson tutor and completion-quiz generator.
 * Unsupported, scanned/image-only, corrupt, or unreadable files return an empty string so an
 * unavailable document can never break the surrounding learning flow.
 */
export async function extractTextFromResourceFile(
  stream: NodeJS.ReadableStream,
  mimeType: string | null,
): Promise<string> {
  if (!mimeType || !EXTRACTABLE_DOCUMENT_MIME_TYPES.has(mimeType)) return '';

  try {
    const fileBuffer = await readStreamToBuffer(stream);

    if (mimeType === 'application/pdf') return extractPdfText(fileBuffer);
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return extractDocxText(fileBuffer);
    }
    return extractPptxText(fileBuffer);
  } catch (error) {
    logger.warn('Failed to extract text from lesson resource document', { error, mimeType });
    return '';
  }
}

async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(fileBuffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}

/** PPTX is a zip of per-slide XML files; slide text lives in `<a:t>` runs. */
async function extractPptxText(fileBuffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const slideTexts = await Promise.all(
    slideFiles.map(async (name) => {
      const xml = await zip.files[name]?.async('string');
      if (!xml) return '';
      return [...xml.matchAll(PPTX_TEXT_TAG_PATTERN)].map((match) => match[1]).join(' ');
    }),
  );

  return slideTexts.join('\n\n');
}

function slideNumber(entryName: string): number {
  return Number(/slide(\d+)\.xml$/.exec(entryName)?.[1] ?? 0);
}
