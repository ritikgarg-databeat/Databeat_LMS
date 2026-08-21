// TypeScript types and interfaces for the classroom feature.
//
// Mirrors the backend's Course -> CourseModule -> Lesson -> LessonResource hierarchy
// (backend/src/prisma/schema.prisma) plus the CourseGroupAssignment/LessonProgress side
// tables. NOTE: the Prisma model is named `CourseModule` (not `Module`) to stay unambiguous
// next to the ES module concept — this file follows the same naming.

export type CourseDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ResourceType =
  | 'MARKDOWN'
  | 'PDF'
  | 'VIDEO'
  | 'IMAGE'
  | 'PRESENTATION'
  | 'DOCUMENT'
  | 'ZIP'
  | 'EXTERNAL_LINK'
  | 'CODE_SNIPPET';
export type LessonProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type CourseSortField = 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';

/* -------------------------------------------------------------------------- */
/* Courses                                                                     */
/* -------------------------------------------------------------------------- */

export interface CourseDepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface CourseExperienceLevelSummary {
  id: string;
  name: string;
  code: string;
}

export interface CourseCreatedBySummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CourseGroupSummary {
  id: string;
  name: string;
  code: string;
}

/** `GET /courses/:id/assignments` list item — `id` is the groupId. */
export interface CourseGroupAssignmentSummary extends CourseGroupSummary {
  memberCount: number;
}

/** Response shape of `POST /courses/:id/assignments`. */
export interface CourseGroupAssignment {
  id: string;
  courseId: string;
  groupId: string;
  assignedById: string | null;
  assignedAt: string;
  group: CourseGroupSummary;
}

/** Scalar fields shared by every course representation, regardless of viewer role. */
interface CourseBase {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  departmentId: string | null;
  experienceLevelId: string | null;
  estimatedDurationMinutes: number | null;
  difficulty: CourseDifficulty;
  status: CourseStatus;
  createdById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A course as returned by the management-facing endpoints that don't include the derived
 * counts (`POST /courses`, `PATCH /courses/:id`, `PATCH /courses/:id/status`,
 * `POST /courses/:id/duplicate`).
 */
export interface Course extends CourseBase {
  department: CourseDepartmentSummary | null;
  experienceLevel: CourseExperienceLevelSummary | null;
  createdBy: CourseCreatedBySummary | null;
}

/** `GET /courses` list item — adds the derived module/lesson/assignment counts. */
export interface CourseSummary extends Course {
  moduleCount: number;
  lessonCount: number;
  assignedGroupsCount: number;
}

/**
 * `GET /courses/mine` (trainee) list item. Deliberately does NOT extend `Course` — the learner
 * listing omits `department`/`experienceLevel`/`createdBy` entirely and adds a computed
 * `completionPercentage` instead of `assignedGroupsCount`.
 */
export interface MyCourseSummary extends CourseBase {
  moduleCount: number;
  lessonCount: number;
  completionPercentage: number;
}

/** A module as nested inside `CourseDetail.modules` (or returned by `GET /modules/:id`). */
export interface CourseModuleWithLessons extends CourseModule {
  lessons: Lesson[];
}

/** `GET /courses/:id` — scalar fields + relations, plus the full module/lesson tree. */
export interface CourseDetail extends Course {
  modules: CourseModuleWithLessons[];
  assignedGroups: CourseGroupSummary[];
}

export interface CourseListFilters {
  status?: CourseStatus;
  difficulty?: CourseDifficulty;
  departmentId?: string;
  experienceLevelId?: string;
  search?: string;
}

export interface CourseListParams extends CourseListFilters {
  page: number;
  pageSize: number;
  sortBy?: CourseSortField;
  sortOrder?: SortOrder;
}

export interface CreateCoursePayload {
  title: string;
  description?: string;
  thumbnail?: string;
  departmentId?: string;
  experienceLevelId?: string;
  estimatedDurationMinutes?: number;
  difficulty?: CourseDifficulty;
}

/** `status` is deliberately absent — status only ever changes via `updateStatus`. */
export interface UpdateCoursePayload {
  title?: string;
  description?: string | null;
  thumbnail?: string | null;
  departmentId?: string | null;
  experienceLevelId?: string | null;
  estimatedDurationMinutes?: number | null;
  difficulty?: CourseDifficulty;
}

export interface UpdateCourseStatusPayload {
  status: CourseStatus;
}

export interface DuplicateCoursePayload {
  title: string;
  includeResources?: boolean;
}

export interface AssignGroupPayload {
  groupId: string;
}

export interface CourseStats {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  archivedCourses: number;
  assignedGroupsCount: number;
  activeLearners: number;
}

/* -------------------------------------------------------------------------- */
/* Modules                                                                     */
/* -------------------------------------------------------------------------- */

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  estimatedDurationMinutes: number | null;
  isPublished: boolean;
  contentVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** `GET /modules?courseId=X` list item — adds the derived lesson count. */
export interface CourseModuleSummary extends CourseModule {
  _count: { lessons: number };
}

export interface ModuleListParams {
  courseId: string;
}

export interface CreateModulePayload {
  courseId: string;
  title: string;
  description?: string;
  estimatedDurationMinutes?: number;
}

export interface UpdateModulePayload {
  title?: string;
  description?: string | null;
  estimatedDurationMinutes?: number | null;
}

export interface UpdateModuleStatusPayload {
  isPublished: boolean;
}

export interface ReorderModulesPayload {
  courseId: string;
  orderedIds: string[];
}

/* -------------------------------------------------------------------------- */
/* Lessons                                                                     */
/* -------------------------------------------------------------------------- */

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  type: ResourceType;
  order: number;
  estimatedDurationMinutes: number | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `GET /lessons?moduleId=X` list item — adds the derived resource count. */
export interface LessonSummary extends Lesson {
  _count: { resources: number };
}

/** The lesson's parent module/course breadcrumb, as embedded in `LessonDetail`. */
export interface LessonModuleSummary {
  id: string;
  title: string;
  course: {
    id: string;
    title: string;
    status: CourseStatus;
  };
}

/** `GET /lessons/:id` — the trainer-editor AND trainee-viewer shape. */
export interface LessonDetail extends Lesson {
  resources: LessonResource[];
  module: LessonModuleSummary;
  progress: LessonProgressView | null;
}

export interface LessonListParams {
  moduleId: string;
}

export interface CreateLessonPayload {
  moduleId: string;
  title: string;
  description?: string;
  type: ResourceType;
  estimatedDurationMinutes?: number;
}

export interface UpdateLessonPayload {
  title?: string;
  description?: string | null;
  type?: ResourceType;
  estimatedDurationMinutes?: number | null;
}

export interface UpdateLessonStatusPayload {
  isPublished: boolean;
}

export interface ReorderLessonsPayload {
  moduleId: string;
  orderedIds: string[];
}

/* -------------------------------------------------------------------------- */
/* Resources                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * File-backed types (PDF/VIDEO/IMAGE/PRESENTATION/DOCUMENT/ZIP) populate
 * relativePath/originalFilename/mimeType/fileSizeBytes and leave `content` null. Text-backed
 * types (MARKDOWN/CODE_SNIPPET) and EXTERNAL_LINK populate `content` and leave the file fields
 * null — see `RESOURCE_TYPE_META` in ../constants for the `isFileBacked` lookup.
 */
export interface LessonResource {
  id: string;
  lessonId: string;
  type: ResourceType;
  title: string;
  relativePath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  content: string | null;
  order: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST /lessons/:id/resources/upload` (multipart) — `type` must be file-backed. */
export interface UploadResourcePayload {
  title: string;
  type: ResourceType;
  file: File;
}

/** Body for `POST /lessons/:id/resources/text` — `type` must be text-backed. */
export interface CreateTextResourcePayload {
  type: ResourceType;
  title: string;
  content: string;
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export interface LessonProgressView {
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: string | null;
  completedAt: string | null;
  completedContentVersion: number | null;
  currentContentVersion: number;
  hasNewContent: boolean;
}

export interface UpsertLessonProgressPayload {
  status?: LessonProgressStatus;
  timeSpentSecondsDelta?: number;
}

/* -------------------------------------------------------------------------- */
/* Lesson completion quiz                                                     */
/* -------------------------------------------------------------------------- */

export interface QuizOption {
  id: string;
  text: string;
}

export interface SanitizedQuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

/** `GET /lessons/:id/quiz` response — a discriminated union on `required`/`status`. */
export type LessonQuizView =
  | { required: false }
  | { required: true; status: 'GENERATED'; passingPercentage: number; questions: SanitizedQuizQuestion[] }
  | {
      required: true;
      status: 'SUBMITTED';
      score: number;
      totalQuestions: number;
      percentage: number;
      passingPercentage: number;
      passed: boolean;
    };

export interface SubmitLessonQuizPayload {
  answers: { questionId: string; selectedOptionId: string }[];
}

export interface LessonQuizResultQuestion {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
}

export interface LessonQuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  passingPercentage: number;
  passed: boolean;
  results: LessonQuizResultQuestion[];
}

export interface ContinueLearningItem {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: string | null;
  hasNewContent: boolean;
}

export interface ProgressSummary {
  assignedCoursesCount: number;
  overallCompletionPercentage: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  hoursSpent: number;
}

export interface CourseLessonProgress {
  lessonId: string;
  title: string;
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  hasNewContent: boolean;
}

export interface CourseModuleProgress {
  moduleId: string;
  title: string;
  percentage: number;
  lessons: CourseLessonProgress[];
}

export interface CourseProgressBreakdown {
  courseId: string;
  overallPercentage: number;
  modules: CourseModuleProgress[];
}
