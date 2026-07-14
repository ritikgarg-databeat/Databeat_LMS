/**
 * Date formatting helpers. Centralized so a future change to locale/format conventions
 * (or a swap to a library like date-fns) happens in one place.
 */

const DEFAULT_LOCALE = 'en-US';

export function formatDate(input: string | number | Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium' }).format(new Date(input));
}

export function formatDateTime(input: string | number | Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(input),
  );
}

export function formatTime(input: string | number | Date): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeStyle: 'short' }).format(new Date(input));
}

/** e.g. "3 hours ago", "in 2 days" — used for activity feeds and notifications. */
export function formatRelativeTime(input: string | number | Date): string {
  const target = new Date(input).getTime();
  const diffSeconds = Math.round((target - Date.now()) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];

  const rtf = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: 'auto' });

  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }

  return rtf.format(0, 'second');
}
