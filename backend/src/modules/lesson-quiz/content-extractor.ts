import { buffer as readStreamToBuffer } from 'node:stream/consumers';

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { logger } from '@/utils/logger';

const PPTX_TEXT_TAG_PATTERN = /<a:t>([^<]*)<\/a:t>/g;

/**
 * Best-effort text extraction from an uploaded lesson-resource file, so the quiz generator can
 * see real theory content even when a trainer added it as a PDF/DOCX/PPTX upload rather than a
 * pasted MARKDOWN resource (the only source `ai/context-builder.ts` reads). Any failure (a
 * scanned/image-only PDF with no text layer, a corrupt file, an unsupported mime type) returns
 * an empty string rather than throwing — the caller already treats "no extractable content" as
 * "skip the quiz gate", the same graceful path as a lesson with genuinely no content.
 */
export async function extractTextFromResourceFile(stream: NodeJS.ReadableStream, mimeType: string | null): Promise<string> {
  if (!mimeType) return '';

  try {
    const fileBuffer = await readStreamToBuffer(stream);

    if (mimeType === 'application/pdf') {
      return extractPdfText(fileBuffer);
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return extractDocxText(fileBuffer);
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return extractPptxText(fileBuffer);
    }
    return '';
  } catch (error) {
    logger.warn('Failed to extract text from lesson resource file for quiz generation', { error, mimeType });
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
