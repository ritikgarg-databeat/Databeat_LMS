// Internal domain types for the lessons module.
export interface LessonListFilters {
  moduleId: string;
}

/** Shape consumed by `LessonsRepository#reorder` — index in the request becomes the new `order`. */
export interface ReorderItem {
  id: string;
  order: number;
}
