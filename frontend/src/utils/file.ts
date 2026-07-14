/** File-related presentation helpers for the File Management / Classroom features. */

const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), SIZE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${SIZE_UNITS[exponent]}`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? (parts.pop() ?? '').toLowerCase() : '';
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(filename));
}
