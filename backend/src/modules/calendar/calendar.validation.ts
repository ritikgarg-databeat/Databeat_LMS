import { CalendarEventType } from '@prisma/client';
import { body, query } from 'express-validator';

import {
  MAX_CALENDAR_EVENT_DESCRIPTION_LENGTH,
  MAX_CALENDAR_EVENT_LOCATION_LENGTH,
  MAX_CALENDAR_EVENT_TITLE_LENGTH,
} from '@/constants/assessment';

// Factories, not shared chain instances — express-validator's `.optional()` mutates the chain's
// underlying builder in place and returns the SAME reference, so a shared const reused bare in
// `create` and as `.optional()` in `update` would retroactively make `create`'s field optional
// too (see courses.validation.ts / groups.validation.ts for the same fix already applied there).
const titleChain = () => body('title').trim().isLength({ min: 1, max: MAX_CALENDAR_EVENT_TITLE_LENGTH });
const typeChain = () =>
  body('type').isIn(Object.values(CalendarEventType)).withMessage('type must be valid.');
const startAtChain = () =>
  body('startAt').isISO8601().withMessage('startAt must be a valid ISO8601 date-time.');

// These are referenced bare (no extra chained calls) in both `create` and `update`, so — unlike
// the three above — a single shared instance is safe (mirrors descriptionChain/thumbnailChain in
// courses.validation.ts).
const descriptionChain = body('description')
  .optional({ values: 'null' })
  .isString()
  .isLength({ max: MAX_CALENDAR_EVENT_DESCRIPTION_LENGTH });
const endAtChain = body('endAt')
  .optional({ values: 'null' })
  .isISO8601()
  .withMessage('endAt must be a valid ISO8601 date-time.');
const allDayChain = body('allDay')
  .optional()
  .isBoolean()
  .withMessage('allDay must be a boolean.')
  .toBoolean();
const locationChain = body('location')
  .optional({ values: 'null' })
  .isString()
  .isLength({ max: MAX_CALENDAR_EVENT_LOCATION_LENGTH });
const departmentIdsChain = body('departmentIds')
  .optional()
  .isArray()
  .withMessage('departmentIds must be an array.');
const departmentIdsItemChain = body('departmentIds.*')
  .isUUID()
  .withMessage('Each departmentId must be a valid identifier.');
const groupIdsChain = body('groupIds').optional().isArray().withMessage('groupIds must be an array.');
const groupIdsItemChain = body('groupIds.*').isUUID().withMessage('Each groupId must be a valid identifier.');

const fromQueryChain = query('from')
  .optional()
  .isISO8601()
  .withMessage('from must be a valid ISO8601 date-time.');
const toQueryChain = query('to').optional().isISO8601().withMessage('to must be a valid ISO8601 date-time.');

export const calendarValidation = {
  create: [
    titleChain(),
    descriptionChain,
    typeChain(),
    startAtChain(),
    endAtChain,
    allDayChain,
    locationChain,
    departmentIdsChain,
    departmentIdsItemChain,
    groupIdsChain,
    groupIdsItemChain,
  ],

  update: [
    titleChain().optional(),
    descriptionChain,
    typeChain().optional(),
    startAtChain().optional(),
    endAtChain,
    allDayChain,
    locationChain,
    departmentIdsChain,
    departmentIdsItemChain,
    groupIdsChain,
    groupIdsItemChain,
  ],

  list: [
    fromQueryChain,
    toQueryChain,
    query('type').optional().isIn(Object.values(CalendarEventType)).withMessage('type must be valid.'),
  ],

  mine: [fromQueryChain, toQueryChain],
};
