// Internal domain types for the ai module.

export interface LessonContextResource {
  title: string;
  type: string;
  filename?: string;
}

export interface AiGroundingSource {
  /** Stable within one generated prompt and required in an ANSWER response's evidence list. */
  id: string;
  label: string;
  content: string;
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
  /** Description/resource text that may be used as factual evidence. Titles only define scope. */
  groundingSources: AiGroundingSource[];
}

export interface LearningScopeCourse {
  evidenceId: string;
  title: string;
  description?: string;
  departmentName?: string;
  moduleAndLessonTitles: string[];
}

/** Department and accessible-course catalog used to constrain non-lesson tutor conversations. */
export interface LearningScopeContext {
  departmentName?: string;
  courses: LearningScopeCourse[];
}

export interface AiConversationListFilters {
  lessonId?: string;
}
