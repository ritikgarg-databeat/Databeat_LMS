/**
 * Avatar upload limits for the settings module (Prompt 9 § SETTINGS). Enforced by the
 * settings-specific Multer instance's `fileFilter`/`limits` in settings.routes.ts, mirroring
 * the qna module's own per-route Multer instance (constants/qna.ts's `ACCEPTED_QNA_ATTACHMENT_MIME_TYPES`
 * / `MAX_QNA_ATTACHMENT_SIZE_BYTES`) rather than reusing the shared `upload` middleware, whose
 * 200 MB lesson-file cap is wrong for a profile picture.
 */
export const ACCEPTED_AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * `User.avatar` stores only a relative file path, not a MIME type (unlike the `Resource` model,
 * which has its own `mimeType` column) — the extension `generateSafeFilename` preserved at upload
 * time is the only signal left to reconstruct `Content-Type` for `GET /settings/avatar`. Keyed to
 * exactly the same fixed set `ACCEPTED_AVATAR_MIME_TYPES` allows, so this can never drift out of
 * sync with what's actually accepted on upload.
 */
export const AVATAR_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * `entityType` namespace passed to `storageProvider.save({ entityType })` for avatar uploads
 * (see src/storage/storage-provider.interface.ts's `SaveFileInput` doc comment, which already
 * anticipates this value). Also used to recognize — and therefore safely delete — an old avatar
 * file that was stored by us, as opposed to some other value a future feature might put in
 * `User.avatar` (e.g. an externally-hosted URL) that this module must never try to unlink.
 */
export const AVATAR_ENTITY_TYPE = 'avatars';

/**
 * Fixed id of the single `PlatformSettings` row (Prompt 9 § ADMIN SETTINGS). Enforced as a
 * singleton by application logic — the repository always reads/creates/updates the one row with
 * this id — not a DB-level constraint (see schema.prisma's doc comment on the model).
 */
export const PLATFORM_SETTINGS_SINGLETON_ID = 'singleton';
