import { storageProvider } from '@/storage';
import { logger } from '@/utils/logger';

interface VideoDraftPointers {
  id: string;
  artifactRelativePath: string | null;
  captionRelativePath: string | null;
  thumbnailRelativePath: string | null;
  audioArtifacts: unknown;
}

interface DraftOwner {
  type: 'lesson' | 'module' | 'course';
  id: string;
}

export async function deleteVideoDraftFiles(jobs: VideoDraftPointers[], owner: DraftOwner): Promise<void> {
  const paths = jobs.flatMap((job) => {
    const audioPaths = Array.isArray(job.audioArtifacts)
      ? job.audioArtifacts.flatMap((value) => {
          if (typeof value !== 'object' || value === null) return [];
          const relativePath = (value as { relativePath?: unknown }).relativePath;
          return typeof relativePath === 'string' ? [relativePath] : [];
        })
      : [];
    return [
      job.artifactRelativePath,
      job.captionRelativePath,
      job.thumbnailRelativePath,
      ...audioPaths,
    ].filter((value): value is string => Boolean(value));
  });
  await Promise.all(
    paths.map((relativePath) =>
      storageProvider.delete({ relativePath }).catch((error: unknown) => {
        logger.error('Failed to delete AI video draft after parent deletion', {
          error,
          ownerType: owner.type,
          ownerId: owner.id,
          relativePath,
        });
      }),
    ),
  );
}
