import {
  AssessmentStatus,
  CalendarEventType,
  CourseDifficulty,
  CourseStatus,
  DepartmentStatus,
  QuestionCategory,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  ResourceType,
  Role,
  type Prisma,
} from '@prisma/client';

import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { hashPassword } from '@/utils/password.util';

/**
 * OPTIONAL demo/showcase data (Prompt 10 § Part 7 — Demo Data Seeding). This is NOT part of
 * the core seed (`npm run seed`) and is never chained from it — it exists purely to give a
 * fresh environment (e.g. a sales demo or a new contributor's local database) two realistic
 * training batches with a trainer, a handful of trainees, a course, an assessment, and a
 * calendar event already wired together end-to-end. Safe to skip entirely in a real
 * production deployment — nothing else in this codebase depends on any row created here.
 *
 * Idempotent, same as `seed.ts`: every row is created via `upsert` keyed on a natural unique
 * field (email, code) where the model has one, or a fixed, hardcoded id (deterministic UUID
 * literals defined below) where it doesn't — re-running this script never creates duplicates.
 *
 * Run with `npm run seed:demo`.
 */

const DEMO_DEPARTMENT_NAMES = ['Media', 'Media Data'];

// Reused verbatim from the core seed's list — upserting on `code` means this never creates a
// second "Fresher"/"Experienced" row if `npm run seed` already created them, and still works
// standalone (e.g. this script run before the core seed) if it hasn't.
const DEMO_EXPERIENCE_LEVELS = [
  { name: 'Fresher', code: 'FRESHER' },
  { name: 'Experienced', code: 'EXPERIENCED' },
];

const DEMO_GROUPS = [
  {
    name: 'Media Freshers Batch',
    code: 'MEDIA_FRESHERS_BATCH',
    departmentName: 'Media',
    experienceLevelCode: 'FRESHER',
  },
  {
    name: 'Media Data Experienced Batch',
    code: 'MEDIA_DATA_EXPERIENCED_BATCH',
    departmentName: 'Media Data',
    experienceLevelCode: 'EXPERIENCED',
  },
] as const;

// Deliberately NOT `@databeat.lms` (the domain used by this project's other seeded/test
// accounts, e.g. `tara.trainer@databeat.lms`) so this data can never collide with them.
const DEMO_TRAINER = {
  firstName: 'Ananya',
  lastName: 'Rao',
  email: process.env.SEED_DEMO_TRAINER_EMAIL ?? 'ananya.rao@demo.databeat.lms',
  password: process.env.SEED_DEMO_TRAINER_PASSWORD ?? 'DemoTrainer#2026',
};

const DEMO_TRAINEE_PASSWORD = process.env.SEED_DEMO_TRAINEE_PASSWORD ?? 'DemoTrainee#2026';

const DEMO_TRAINEES = [
  {
    firstName: 'Rahul',
    lastName: 'Verma',
    email: 'rahul.verma@demo.databeat.lms',
    groupCode: 'MEDIA_FRESHERS_BATCH',
    departmentName: 'Media',
    experienceLevelCode: 'FRESHER',
  },
  {
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'priya.nair@demo.databeat.lms',
    groupCode: 'MEDIA_FRESHERS_BATCH',
    departmentName: 'Media',
    experienceLevelCode: 'FRESHER',
  },
  {
    firstName: 'Karan',
    lastName: 'Mehta',
    email: 'karan.mehta@demo.databeat.lms',
    groupCode: 'MEDIA_DATA_EXPERIENCED_BATCH',
    departmentName: 'Media Data',
    experienceLevelCode: 'EXPERIENCED',
  },
] as const;

// Fixed, hardcoded ids for models with no natural unique field to upsert on (Course,
// CourseModule, Lesson, LessonResource, Question, QuestionOption, Assessment, CalendarEvent,
// CalendarEventAssignment). Valid-looking v4 UUIDs so every existing route that validates
// `:id` params with `isUUID()` (see `idParamValidator`) keeps working against this data.
const DEMO_COURSE_ID = '8f14e845-1000-4a00-8000-000000000001';
const DEMO_MODULE_ID = '8f14e845-1000-4a00-8000-000000000002';
const DEMO_LESSON_ID = '8f14e845-1000-4a00-8000-000000000003';
const DEMO_LESSON_RESOURCE_ID = '8f14e845-1000-4a00-8000-000000000004';
const DEMO_ASSESSMENT_ID = '8f14e845-1000-4a00-8000-000000000007';
const DEMO_CALENDAR_EVENT_ID = '8f14e845-1000-4a00-8000-000000000008';
const DEMO_CALENDAR_ASSIGNMENT_DEPARTMENT_ID = '8f14e845-1000-4a00-8000-000000000009';
const DEMO_CALENDAR_ASSIGNMENT_GROUP_ID = '8f14e845-1000-4a00-8000-00000000000a';

interface DemoQuestionOptionSeed {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface DemoQuestionSeed {
  id: string;
  title: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  explanation: string;
  assessmentOrder: number;
  marks: number;
  options: DemoQuestionOptionSeed[];
}

const DEMO_QUESTIONS: DemoQuestionSeed[] = [
  {
    id: '8f14e845-1000-4a00-8000-000000000005',
    title: 'Which of the following is a measure of central tendency?',
    type: QuestionType.SINGLE_CORRECT_MCQ,
    category: QuestionCategory.STATISTICS,
    difficulty: QuestionDifficulty.EASY,
    explanation:
      'The mean is a measure of central tendency; standard deviation, variance, and range all describe spread/dispersion instead.',
    assessmentOrder: 1,
    marks: 5,
    options: [
      { id: '8f14e845-1000-4a00-8001-000000000001', text: 'Mean', isCorrect: true, order: 1 },
      { id: '8f14e845-1000-4a00-8001-000000000002', text: 'Standard Deviation', isCorrect: false, order: 2 },
      { id: '8f14e845-1000-4a00-8001-000000000003', text: 'Variance', isCorrect: false, order: 3 },
      { id: '8f14e845-1000-4a00-8001-000000000004', text: 'Range', isCorrect: false, order: 4 },
    ],
  },
  {
    id: '8f14e845-1000-4a00-8000-000000000006',
    title: 'Which of the following are commonly used data visualization tools? (Select all that apply)',
    type: QuestionType.MULTIPLE_CORRECT,
    category: QuestionCategory.DATA_ANALYTICS,
    difficulty: QuestionDifficulty.MEDIUM,
    explanation:
      'Power BI and Excel are both widely used to build charts and dashboards; Notepad and Windows Media Player are not data visualization tools.',
    assessmentOrder: 2,
    marks: 5,
    options: [
      { id: '8f14e845-1000-4a00-8002-000000000001', text: 'Power BI', isCorrect: true, order: 1 },
      { id: '8f14e845-1000-4a00-8002-000000000002', text: 'Microsoft Excel', isCorrect: true, order: 2 },
      { id: '8f14e845-1000-4a00-8002-000000000003', text: 'Notepad', isCorrect: false, order: 3 },
      { id: '8f14e845-1000-4a00-8002-000000000004', text: 'Windows Media Player', isCorrect: false, order: 4 },
    ],
  },
];

/** Mirrors the backfill convention used by the `organization_management` migration (duplicated
 * from `seed.ts` rather than imported — see this file's header comment). */
function codeFromName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

async function main(): Promise<void> {
  // 1. Departments ------------------------------------------------------------------------
  const departments = await Promise.all(
    DEMO_DEPARTMENT_NAMES.map((name) =>
      prisma.department.upsert({
        where: { name },
        update: {},
        create: { name, code: codeFromName(name), status: DepartmentStatus.ACTIVE },
      }),
    ),
  );
  logger.info(`[demo] Seeded ${departments.length} departments (Media, Media Data).`);

  const mediaDepartment = departments.find((department) => department.name === 'Media');
  const mediaDataDepartment = departments.find((department) => department.name === 'Media Data');
  if (!mediaDepartment || !mediaDataDepartment) {
    throw new Error('Failed to seed the Media / Media Data departments.');
  }
  const departmentsByName = new Map([
    ['Media', mediaDepartment],
    ['Media Data', mediaDataDepartment],
  ]);

  // 2. Experience levels (reused from the core seed's set, never duplicated) --------------
  const experienceLevels = await Promise.all(
    DEMO_EXPERIENCE_LEVELS.map((level) =>
      prisma.experienceLevel.upsert({ where: { code: level.code }, update: {}, create: level }),
    ),
  );
  const experienceLevelsByCode = new Map(experienceLevels.map((level) => [level.code, level]));
  logger.info(`[demo] Seeded ${experienceLevels.length} experience levels (Fresher, Experienced).`);

  // 3. Sample trainer -----------------------------------------------------------------------
  // `passwordChangedAt` is set at creation (unlike the core seed's real Super Admin account) so
  // demo logins never trip the app-wide "force password change on first login" gate (Prompt 10
  // § Part 6) — these are throwaway showcase credentials meant for frictionless exploration, not
  // a real account whose initial password should be rotated.
  const trainerPasswordHash = await hashPassword(DEMO_TRAINER.password);
  const trainer = await prisma.user.upsert({
    where: { email: DEMO_TRAINER.email },
    update: {},
    create: {
      firstName: DEMO_TRAINER.firstName,
      lastName: DEMO_TRAINER.lastName,
      email: DEMO_TRAINER.email,
      passwordHash: trainerPasswordHash,
      role: Role.TRAINER,
      isActive: true,
      isEmailVerified: true,
      passwordChangedAt: new Date(),
    },
  });
  logger.info(`[demo] Seeded trainer account: ${DEMO_TRAINER.email} / ${DEMO_TRAINER.password}.`);

  // 4. Sample trainees ----------------------------------------------------------------------
  const traineePasswordHash = await hashPassword(DEMO_TRAINEE_PASSWORD);
  const trainees = await Promise.all(
    DEMO_TRAINEES.map((trainee) => {
      const department = departmentsByName.get(trainee.departmentName);
      const experienceLevel = experienceLevelsByCode.get(trainee.experienceLevelCode);
      return prisma.user.upsert({
        where: { email: trainee.email },
        update: {},
        create: {
          firstName: trainee.firstName,
          lastName: trainee.lastName,
          email: trainee.email,
          passwordHash: traineePasswordHash,
          role: Role.TRAINEE,
          departmentId: department?.id,
          experienceLevelId: experienceLevel?.id,
          isActive: true,
          isEmailVerified: true,
          // See the trainer's identical field above — same reasoning.
          passwordChangedAt: new Date(),
        },
      });
    }),
  );
  logger.info(`[demo] Seeded ${trainees.length} trainee accounts (password: ${DEMO_TRAINEE_PASSWORD}).`);

  // 5. Groups ------------------------------------------------------------------------------
  const groups = await Promise.all(
    DEMO_GROUPS.map((group) => {
      const department = departmentsByName.get(group.departmentName);
      if (!department) throw new Error(`Missing department for demo group "${group.name}".`);
      const experienceLevel = experienceLevelsByCode.get(group.experienceLevelCode);

      return prisma.group.upsert({
        where: { code: group.code },
        update: {},
        create: {
          name: group.name,
          code: group.code,
          departmentId: department.id,
          experienceLevelId: experienceLevel?.id,
          trainerId: trainer.id,
          description: `Demo training batch created by seed-demo.ts for the ${group.departmentName} department.`,
        },
      });
    }),
  );
  const groupsByCode = new Map(groups.map((group) => [group.code, group]));
  const freshersBatch = groupsByCode.get('MEDIA_FRESHERS_BATCH');
  const experiencedBatch = groupsByCode.get('MEDIA_DATA_EXPERIENCED_BATCH');
  if (!freshersBatch || !experiencedBatch) throw new Error('Failed to seed the demo groups.');
  logger.info(`[demo] Seeded ${groups.length} groups (Media Freshers Batch, Media Data Experienced Batch).`);

  // 6. Group memberships ---------------------------------------------------------------------
  await Promise.all(
    DEMO_TRAINEES.map((traineeSeed, index) => {
      const trainee = trainees[index];
      const group = groupsByCode.get(traineeSeed.groupCode);
      if (!trainee || !group) return Promise.resolve();

      return prisma.groupMember.upsert({
        where: { userId_groupId: { userId: trainee.id, groupId: group.id } },
        update: {},
        create: { userId: trainee.id, groupId: group.id, addedById: trainer.id },
      });
    }),
  );
  logger.info(`[demo] Added ${trainees.length} trainees to their demo groups.`);

  // 7. Sample course, module, lesson, and lesson resource -----------------------------------
  const course = await prisma.course.upsert({
    where: { id: DEMO_COURSE_ID },
    update: {},
    create: {
      id: DEMO_COURSE_ID,
      title: 'Media Data Analytics Foundations',
      description:
        'An introductory course covering the fundamentals of media data analytics: key metrics, tools, and workflows used day to day by the Media Data team.',
      departmentId: mediaDataDepartment.id,
      estimatedDurationMinutes: 120,
      difficulty: CourseDifficulty.BEGINNER,
      status: CourseStatus.PUBLISHED,
      createdById: trainer.id,
    },
  });

  const courseModule = await prisma.courseModule.upsert({
    where: { id: DEMO_MODULE_ID },
    update: {},
    create: {
      id: DEMO_MODULE_ID,
      courseId: course.id,
      title: 'Getting Started with Media Data',
      description: "Foundational concepts every trainee needs before diving into the team's analytics tooling.",
      order: 1,
      estimatedDurationMinutes: 45,
      isPublished: true,
    },
  });

  const lesson = await prisma.lesson.upsert({
    where: { id: DEMO_LESSON_ID },
    update: {},
    create: {
      id: DEMO_LESSON_ID,
      moduleId: courseModule.id,
      title: 'Welcome to Media Data Analytics',
      description: 'An overview of what this course covers and how the Media Data team works.',
      type: ResourceType.MARKDOWN,
      order: 1,
      estimatedDurationMinutes: 15,
      isPublished: true,
    },
  });

  await prisma.lessonResource.upsert({
    where: { id: DEMO_LESSON_RESOURCE_ID },
    update: {},
    create: {
      id: DEMO_LESSON_RESOURCE_ID,
      lessonId: lesson.id,
      type: ResourceType.MARKDOWN,
      title: 'Course Overview',
      content:
        '# Welcome to Media Data Analytics\n\n' +
        'This course introduces the tools, metrics, and workflows the Media Data team uses every day, ' +
        'including audience metrics, reporting dashboards, and how to turn raw viewership data into ' +
        'actionable insight.\n\n' +
        'By the end of this module you should be able to explain what the team measures and why it matters.',
      order: 0,
      createdById: trainer.id,
    },
  });
  logger.info(`[demo] Seeded course "${course.title}" with one module and one lesson.`);

  // 8. Assign the course to both demo groups --------------------------------------------------
  await Promise.all(
    [freshersBatch, experiencedBatch].map((group) =>
      prisma.courseGroupAssignment.upsert({
        where: { courseId_groupId: { courseId: course.id, groupId: group.id } },
        update: {},
        create: { courseId: course.id, groupId: group.id, assignedById: trainer.id },
      }),
    ),
  );
  logger.info('[demo] Assigned the demo course to both demo groups.');

  // 9. Sample assessment with a couple of bank questions ---------------------------------------
  const assessment = await prisma.assessment.upsert({
    where: { id: DEMO_ASSESSMENT_ID },
    update: {},
    create: {
      id: DEMO_ASSESSMENT_ID,
      title: 'Media Data Fundamentals Quiz',
      description: 'A short quiz checking foundational media data analytics concepts.',
      durationMinutes: 30,
      passingPercentage: 60,
      availableFrom: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      instructions: 'Answer all questions to the best of your ability. You have 30 minutes.',
      negativeMarkingEnabled: false,
      randomizeQuestions: false,
      showResultImmediately: true,
      status: AssessmentStatus.PUBLISHED,
      createdById: trainer.id,
    },
  });

  for (const questionSeed of DEMO_QUESTIONS) {
    const question = await prisma.question.upsert({
      where: { id: questionSeed.id },
      update: {},
      create: {
        id: questionSeed.id,
        title: questionSeed.title,
        type: questionSeed.type,
        category: questionSeed.category,
        difficulty: questionSeed.difficulty,
        status: QuestionStatus.ACTIVE,
        explanation: questionSeed.explanation,
        createdById: trainer.id,
      },
    });

    await Promise.all(
      questionSeed.options.map((option) =>
        prisma.questionOption.upsert({
          where: { id: option.id },
          update: {},
          create: {
            id: option.id,
            questionId: question.id,
            text: option.text,
            isCorrect: option.isCorrect,
            order: option.order,
          },
        }),
      ),
    );

    const snapshotOptions = questionSeed.options.map((option) => ({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
      order: option.order,
    }));

    await prisma.assessmentQuestion.upsert({
      where: { assessmentId_order: { assessmentId: assessment.id, order: questionSeed.assessmentOrder } },
      update: {},
      create: {
        assessmentId: assessment.id,
        questionId: question.id,
        order: questionSeed.assessmentOrder,
        marks: questionSeed.marks,
        snapshotTitle: questionSeed.title,
        snapshotType: questionSeed.type,
        snapshotExplanation: questionSeed.explanation,
        snapshotOptions: snapshotOptions as unknown as Prisma.InputJsonValue,
      },
    });
  }
  logger.info(`[demo] Seeded assessment "${assessment.title}" with ${DEMO_QUESTIONS.length} questions.`);

  // 10. Assign the assessment to both demo groups ----------------------------------------------
  await Promise.all(
    [freshersBatch, experiencedBatch].map((group) =>
      prisma.assessmentGroupAssignment.upsert({
        where: { assessmentId_groupId: { assessmentId: assessment.id, groupId: group.id } },
        update: {},
        create: { assessmentId: assessment.id, groupId: group.id, assignedById: trainer.id },
      }),
    ),
  );
  logger.info('[demo] Assigned the demo assessment to both demo groups.');

  // 11. Sample calendar event, assigned by department AND by group -----------------------------
  const eventStartAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const eventEndAt = new Date(eventStartAt.getTime() + 60 * 60 * 1000);

  const calendarEvent = await prisma.calendarEvent.upsert({
    where: { id: DEMO_CALENDAR_EVENT_ID },
    update: {},
    create: {
      id: DEMO_CALENDAR_EVENT_ID,
      title: 'Media Data Batch Kickoff Review',
      description: 'A live kickoff session covering the course roadmap and quiz expectations for both demo batches.',
      type: CalendarEventType.LIVE_SESSION,
      startAt: eventStartAt,
      endAt: eventEndAt,
      allDay: false,
      location: 'Online — Google Meet',
      createdById: trainer.id,
    },
  });

  // One row targets the Media department (covers Media Freshers Batch trainees via their
  // own `User.departmentId`); the other targets the Media Data Experienced Batch group
  // directly, so both new groups can see this event through their normal read paths.
  await Promise.all([
    prisma.calendarEventAssignment.upsert({
      where: { id: DEMO_CALENDAR_ASSIGNMENT_DEPARTMENT_ID },
      update: {},
      create: { id: DEMO_CALENDAR_ASSIGNMENT_DEPARTMENT_ID, eventId: calendarEvent.id, departmentId: mediaDepartment.id },
    }),
    prisma.calendarEventAssignment.upsert({
      where: { id: DEMO_CALENDAR_ASSIGNMENT_GROUP_ID },
      update: {},
      create: { id: DEMO_CALENDAR_ASSIGNMENT_GROUP_ID, eventId: calendarEvent.id, groupId: experiencedBatch.id },
    }),
  ]);
  logger.info(`[demo] Seeded calendar event "${calendarEvent.title}".`);

  logger.info('[demo] Demo data seed complete.');
}

main()
  .catch((error: unknown) => {
    logger.error('[demo] Demo seed failed', { error });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
