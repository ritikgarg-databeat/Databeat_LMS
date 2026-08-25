import fsPromises from 'node:fs/promises';
import path from 'node:path';

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

import type { LessonVideoProps } from './composition';

interface RenderRequest {
  entryPoint: string;
  publicDir: string;
  bundleCacheDir: string;
  assetNamespace: string;
  frameConcurrency: number | string;
  outputPath: string;
  inputProps: LessonVideoProps;
}

type RendererStage = 'BUNDLING' | 'RENDERING';

function emitProgress(stage: RendererStage, progress: number): void {
  process.stdout.write(`${JSON.stringify({ stage, progress: Math.max(0, Math.min(1, progress)) })}\n`);
}

async function prepareBundle(request: RenderRequest): Promise<string> {
  const readyFile = path.join(request.bundleCacheDir, 'index.html');
  try {
    await fsPromises.access(readyFile);
    emitProgress('BUNDLING', 1);
    return request.bundleCacheDir;
  } catch {
    // Build the bundle below when this renderer version has not been cached yet.
  }

  const buildDir = `${request.bundleCacheDir}.building-${process.pid}`;
  await fsPromises.rm(buildDir, { recursive: true, force: true });
  await fsPromises.mkdir(path.dirname(request.bundleCacheDir), { recursive: true });
  try {
    await bundle({
      entryPoint: request.entryPoint,
      publicDir: null,
      enableCaching: true,
      outDir: buildDir,
      onProgress: (progress) => emitProgress('BUNDLING', progress / 100),
    });
    await fsPromises.rm(request.bundleCacheDir, { recursive: true, force: true });
    await fsPromises.rename(buildDir, request.bundleCacheDir);
    emitProgress('BUNDLING', 1);
    return request.bundleCacheDir;
  } finally {
    await fsPromises.rm(buildDir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const requestPath = process.argv[2];
  if (!requestPath) throw new Error('Renderer request path is required.');
  const request = JSON.parse(await fsPromises.readFile(requestPath, 'utf8')) as RenderRequest;
  const serveUrl = await prepareBundle(request);
  await fsPromises.cp(request.publicDir, path.join(serveUrl, 'public'), {
    recursive: true,
    force: true,
  });
  try {
    const composition = await selectComposition({
      serveUrl,
      id: 'LessonVideo',
      inputProps: request.inputProps as unknown as Record<string, unknown>,
      logLevel: 'error',
    });
    await renderMedia({
      serveUrl,
      composition,
      inputProps: request.inputProps as unknown as Record<string, unknown>,
      codec: 'h264',
      audioCodec: 'aac',
      pixelFormat: 'yuv420p',
      videoBitrate: '2500k',
      audioBitrate: '128k',
      outputLocation: request.outputPath,
      overwrite: true,
      concurrency: request.frameConcurrency,
      logLevel: 'error',
      timeoutInMilliseconds: 60_000,
      chromiumOptions: { ignoreCertificateErrors: false },
      onProgress: ({ progress }) => emitProgress('RENDERING', progress),
    });
  } finally {
    await fsPromises.rm(path.join(serveUrl, 'public', 'assets', request.assetNamespace), {
      recursive: true,
      force: true,
    });
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`Renderer failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
});
