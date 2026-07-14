// Internal domain types for the ai module.

export interface LessonContextResource {
  title: string;
  type: string;
  filename?: string;
}

/** Built by context-builder.ts, consumed by prompt-manager.ts. */
export interface LessonContext {
  lessonId: string;
  lessonTitle: string;
  lessonDescription?: string;
  moduleName: string;
  courseName: string;
  lessonContent?: string;
  resources: LessonContextResource[];
}

export interface AiConversationListFilters {
  lessonId?: string;
}
