import { storageProvider } from '@/storage';
import { logger } from '@/utils/logger';

interface LessonResourceFilePointer {
  id: string;
  relativePath: string | null;
}

interface ResourceOwner {
  type: 'lesson' | 'module' | 'course';
  id: string;
}

/**
 * Removes physical lesson-resource files after their owning database hierarchy has been deleted.
 * Database deletion remains authoritative; a storage-provider failure is logged for manual retry
 * rather than turning a completed database deletion into a misleading failed API response.
 */
export async function deleteLessonResourceFiles(
  resources: LessonResourceFilePointer[],
  owner: ResourceOwner,
): Promise<void> {
  await Promise.all(
    resources.map(async (resource) => {
      if (!resource.relativePath) return;

      try {
        await storageProvider.delete({ relativePath: resource.relativePath });
      } catch (error) {
        logger.error('Failed to delete lesson resource file after parent deletion', {
          error,
          ownerType: owner.type,
          ownerId: owner.id,
          resourceId: resource.id,
          relativePath: resource.relativePath,
        });
      }
    }),
  );
}
