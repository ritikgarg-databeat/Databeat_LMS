import { Router } from 'express';

import { aiRoutes } from '@/modules/ai';
import { analyticsRoutes } from '@/modules/analytics';
import { assessmentsRoutes } from '@/modules/assessments';
import { authRoutes } from '@/modules/auth';
import { calendarRoutes } from '@/modules/calendar';
import { coursesRoutes } from '@/modules/courses';
import { dashboardRoutes } from '@/modules/dashboard';
import { departmentsRoutes } from '@/modules/departments';
import { experienceLevelsRoutes } from '@/modules/experience-levels';
import { groupsRoutes } from '@/modules/groups';
import { lessonsRoutes } from '@/modules/lessons';
import { modulesRoutes } from '@/modules/modules';
import { notificationsRoutes } from '@/modules/notifications';
import { progressRoutes } from '@/modules/progress';
import { qnaRoutes } from '@/modules/qna';
import { questionsRoutes } from '@/modules/questions';
import { reportsRoutes } from '@/modules/reports';
import { settingsRoutes } from '@/modules/settings';
import { usersRoutes } from '@/modules/users';

/**
 * Single mount point for every module's router, under the `/api/v1` prefix applied in app.ts.
 * See ARCHITECTURE.md §11 for the naming/versioning convention these paths follow.
 */
const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/departments', departmentsRoutes);
router.use('/experience-levels', experienceLevelsRoutes);
router.use('/groups', groupsRoutes);
router.use('/courses', coursesRoutes);
router.use('/modules', modulesRoutes);
router.use('/lessons', lessonsRoutes);
router.use('/progress', progressRoutes);
router.use('/assessments', assessmentsRoutes);
router.use('/questions', questionsRoutes);
router.use('/calendar', calendarRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/qna', qnaRoutes);
router.use('/reports', reportsRoutes);
router.use('/ai', aiRoutes);
router.use('/settings', settingsRoutes);

export default router;
