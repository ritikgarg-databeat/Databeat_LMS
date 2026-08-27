// express-validator chains for the dashboard module's routes, keyed by handler name.
//
// Neither route takes any query/body input, so there is nothing to
// validate — both entries are empty arrays. Kept as an explicit, exported map (rather than
// omitted) so dashboard.routes.ts can wire it in the same shape as every other module, and so a
// future param (e.g. a date-range filter) has an obvious place to land.
export const dashboardValidation = {
  trainee: [],
  trainer: [],
};
