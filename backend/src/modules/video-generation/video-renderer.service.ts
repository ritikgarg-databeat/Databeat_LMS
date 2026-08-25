import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buffer as readStreamToBuffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';

import JSZip from 'jszip';

import { env } from '@/config/env';
import { MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';
import { storageProvider, type StoredFilePointer } from '@/storage';

import type { AudioArtifact, VideoStoryboardV1 } from './video-generation.types';
import { createWebVttCaptions } from './video-generation.utils';

interface RenderResult {
  artifact: StoredFilePointer;
  captions: StoredFilePointer;
  sizeBytes: number;
}

export interface RendererProgress {
  stage: 'BUNDLING' | 'RENDERING';
  progress: number;
}

export interface RendererVisualAsset {
  sourceRef: string;
  relativePath: string;
  originalFilename: string | null;
  type: 'IMAGE' | 'PRESENTATION';
}

export class VideoRendererService {
  async render(
    jobId: string,
    storyboard: VideoStoryboardV1,
    audioArtifacts: AudioArtifact[],
    style: 'CLEAN_CORPORATE' | 'VISUAL_EXPLAINER' | 'CODE_WALKTHROUGH',
    visualAssets: RendererVisualAsset[] = [],
    frameConcurrency: number | string = env.VIDEO_FRAME_CONCURRENCY,
    signal?: AbortSignal,
    onProgress?: (event: RendererProgress) => void,
  ): Promise<RenderResult> {
    const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'databeat-video-'));
    const publicDir = path.join(tempDir, 'public');
    const assetNamespace = jobId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!assetNamespace) throw new Error('Video render job ID is invalid.');
    const assetPrefix = `assets/${assetNamespace}`;
    const assetDir = path.join(publicDir, 'assets', assetNamespace);
    const audioDir = path.join(assetDir, 'audio');
    const outputPath = path.join(tempDir, 'lesson-video.mp4');
    const requestPath = path.join(tempDir, 'render-request.json');
    let bundleCacheDir: string | undefined;
    await fsPromises.mkdir(audioDir, { recursive: true });

    try {
      const audioFiles: Record<string, string> = {};
      const visualFiles: Record<string, string> = {};
      for (const artifact of audioArtifacts) {
        const filename = `${artifact.hash}.mp3`;
        const localPath = path.join(audioDir, filename);
        await pipeline(
          await storageProvider.getReadStream({ relativePath: artifact.relativePath }),
          fs.createWriteStream(localPath),
        );
        audioFiles[artifact.sceneId] = `${assetPrefix}/audio/${filename}`;
      }
      for (const asset of visualAssets) {
        if (asset.type === 'PRESENTATION') {
          const archive = await JSZip.loadAsync(
            await readStreamToBuffer(
              await storageProvider.getReadStream({ relativePath: asset.relativePath }),
            ),
          );
          const mediaName = Object.keys(archive.files).find((name) =>
            /^ppt\/media\/[^/]+\.(png|jpe?g|webp|gif)$/i.test(name),
          );
          if (mediaName) {
            const extension = path.extname(mediaName).toLowerCase();
            const filename = `${asset.sourceRef}${extension}`;
            const media = await archive.files[mediaName]?.async('nodebuffer');
            if (media) {
              await fsPromises.writeFile(path.join(assetDir, filename), media);
              visualFiles[asset.sourceRef] = `${assetPrefix}/${filename}`;
            }
          }
          continue;
        }
        const extension = path.extname(asset.originalFilename ?? '').toLowerCase();
        const safeExtension = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension)
          ? extension
          : '.png';
        const filename = `${asset.sourceRef}${safeExtension}`;
        await pipeline(
          await storageProvider.getReadStream({ relativePath: asset.relativePath }),
          fs.createWriteStream(path.join(assetDir, filename)),
        );
        visualFiles[asset.sourceRef] = `${assetPrefix}/${filename}`;
      }

      const entryPoint = this.resolveRendererFile('index');
      bundleCacheDir = await this.resolveBundleCacheDir(entryPoint);
      await fsPromises.writeFile(
        requestPath,
        JSON.stringify({
          entryPoint,
          publicDir,
          bundleCacheDir,
          assetNamespace,
          frameConcurrency,
          outputPath,
          inputProps: { storyboard, audioFiles, visualFiles, style },
        }),
        'utf8',
      );
      await this.runChild(requestPath, signal, onProgress);
      const stat = await fsPromises.stat(outputPath);
      if (stat.size > MAX_LESSON_FILE_SIZE_BYTES) {
        throw new Error('Rendered video exceeds the lesson resource storage limit.');
      }
      const artifact = await storageProvider.save({
        tempPath: outputPath,
        originalName: `lesson-video-${jobId}.mp4`,
        entityType: 'video-generation-drafts',
      });
      const captions = await storageProvider.save({
        buffer: Buffer.from(createWebVttCaptions(storyboard)),
        originalName: `lesson-video-${jobId}.vtt`,
        entityType: 'video-generation-captions',
      });
      return { artifact, captions, sizeBytes: stat.size };
    } finally {
      await Promise.allSettled([
        fsPromises.rm(tempDir, { recursive: true, force: true }),
        bundleCacheDir
          ? fsPromises.rm(path.join(bundleCacheDir, 'public', 'assets', assetNamespace), {
              recursive: true,
              force: true,
            })
          : Promise.resolve(),
      ]);
    }
  }

  private resolveRendererFile(name: 'index' | 'child'): string {
    const tsxOrTs = path.resolve(
      __dirname,
      `../../video-renderer/${name}.${name === 'index' ? 'tsx' : 'ts'}`,
    );
    if (fs.existsSync(tsxOrTs)) return tsxOrTs;
    return path.resolve(__dirname, `../../video-renderer/${name}.js`);
  }

  private async resolveBundleCacheDir(entryPoint: string): Promise<string> {
    const rendererDir = path.dirname(entryPoint);
    const rendererFiles = (await fsPromises.readdir(rendererDir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && /\.(?:js|ts|tsx)$/.test(entry.name) && entry.name !== 'child.ts')
      .map((entry) => entry.name)
      .sort();
    const fingerprint = createHash('sha256');
    for (const filename of rendererFiles) {
      fingerprint.update(filename);
      fingerprint.update(await fsPromises.readFile(path.join(rendererDir, filename)));
    }
    const cacheRoot = path.join(os.tmpdir(), 'databeat-remotion-bundles');
    await fsPromises.mkdir(cacheRoot, { recursive: true });
    return path.join(cacheRoot, fingerprint.digest('hex').slice(0, 24));
  }

  private runChild(
    requestPath: string,
    signal?: AbortSignal,
    onProgress?: (event: RendererProgress) => void,
  ): Promise<void> {
    const childPath = this.resolveRendererFile('child');
    const isTypeScript = childPath.endsWith('.ts');
    const args = [
      '--max-old-space-size=2048',
      ...(isTypeScript ? ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register'] : []),
      childPath,
      requestPath,
    ];
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Video rendering cancelled.'));
        return;
      }
      const child = spawn(process.execPath, args, {
        cwd: path.resolve(__dirname, '../../..'),
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
      });
      let stderr = '';
      let stdout = '';
      let settled = false;
      let terminatingError: Error | null = null;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error);
        else resolve();
      };
      const terminate = (error: Error) => {
        if (settled || terminatingError) return;
        terminatingError = error;
        void terminateProcessTree(child.pid).finally(() => finish(error));
      };
      const abort = () => terminate(new Error('Video rendering cancelled.'));
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < 4000) stderr += chunk.toString('utf8');
      });
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
        const lines = stdout.split(/\r?\n/);
        stdout = lines.pop() ?? '';
        for (const line of lines) this.forwardProgress(line, onProgress);
      });
      const timeout = setTimeout(
        () => terminate(new Error('Video rendering timed out.')),
        env.VIDEO_RENDER_TIMEOUT_MS,
      );
      signal?.addEventListener('abort', abort, { once: true });
      child.once('error', (error) => {
        if (!terminatingError) finish(error);
      });
      child.once('exit', (code) => {
        if (terminatingError) return;
        if (stdout.trim()) this.forwardProgress(stdout, onProgress);
        if (code === 0) finish();
        else finish(new Error(stderr.trim() || `Video renderer exited with code ${code ?? 'unknown'}.`));
      });
    });
  }

  private forwardProgress(line: string, onProgress: ((event: RendererProgress) => void) | undefined): void {
    if (!onProgress || !line.trim()) return;
    try {
      const event = JSON.parse(line) as Partial<RendererProgress>;
      if (
        (event.stage === 'BUNDLING' || event.stage === 'RENDERING') &&
        typeof event.progress === 'number' &&
        Number.isFinite(event.progress)
      ) {
        onProgress({ stage: event.stage, progress: Math.max(0, Math.min(1, event.progress)) });
      }
    } catch {
      // Renderer stdout is a best-effort progress channel; malformed lines do not fail a render.
    }
  }
}

async function terminateProcessTree(pid: number | undefined): Promise<void> {
  if (!pid) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // The process may have already exited between cancellation polling and termination.
    }
    return;
  }
  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.once('error', () => resolve());
    killer.once('exit', () => resolve());
  });
}

export const videoRendererService = new VideoRendererService();
