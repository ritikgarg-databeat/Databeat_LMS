import { query } from 'express-validator';

const fromFilter = query('from').optional({ values: 'falsy' }).isISO8601();
const toFilter = query('to').optional({ values: 'falsy' }).isISO8601();

export const impactMetricsValidation = {
  dateRange: [fromFilter, toFilter],

  pilotDashboard: [
    query('groupId').isUUID().withMessage('groupId must be a valid identifier.'),
    fromFilter,
    toFilter,
  ],

  impactReport: [query('groupId').optional({ values: 'falsy' }).isUUID(), fromFilter, toFilter],
};
