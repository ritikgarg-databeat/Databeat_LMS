import { LocalStorageProvider } from './local-storage.provider';
import type { StorageProvider } from './storage-provider.interface';

export * from './storage-provider.interface';
export * from './local-storage.provider';

/**
 * The single active provider. Swapping to S3/R2/Azure/GCS later is a one-line change here
 * (`new S3StorageProvider(...)`) — nothing outside this file should construct a provider directly.
 */
export const storageProvider: StorageProvider = new LocalStorageProvider();
