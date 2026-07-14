/**
 * Marker base class for module services (`src/modules/<name>/<name>.service.ts`). Currently has no
 * shared behavior — reserved for cross-cutting concerns common to all services later
 * (e.g. structured logging with module context) without touching every module when added.
 */
export abstract class BaseService {}
