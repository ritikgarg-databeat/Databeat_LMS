// Internal domain types for the modules module.
export interface ModuleListFilters {
  courseId: string;
}

/** Shape consumed by `ModulesRepository#reorder` — index in the request becomes the new `order`. */
export interface ReorderItem {
  id: string;
  order: number;
}
