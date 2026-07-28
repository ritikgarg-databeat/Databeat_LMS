const BARE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a `to`/`createdAtTo`-style upper date-range bound for a Prisma `lte` filter. A bare
 * `YYYY-MM-DD` string (what every `<input type="date">` in this app sends) parses via plain
 * `new Date(...)` to that day's UTC midnight, which as an `lte` bound excludes virtually the
 * entire selected end day — used against a full ISO timestamp column, that silently drops real
 * data from every date-filtered report. A string that already carries a time component (a real
 * ISO datetime) is used exactly as given.
 */
export function endOfDayInclusive(value: string): Date {
  if (BARE_DATE_PATTERN.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return new Date(value);
}
