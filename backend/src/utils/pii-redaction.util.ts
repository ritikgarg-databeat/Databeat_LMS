const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const GOVERNMENT_ID_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const IP_ADDRESS_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const COMPACT_PHONE_PATTERN = /\b(?:\+?1)?\d{10}\b/g;
const FORMATTED_PHONE_PATTERN = /(?:\+?\d{1,3}[ .-]?)?(?:\(\d{2,4}\)|\d{2,4})[ .-]\d{3,4}[ .-]\d{4}\b/g;
const LONG_NUMBER_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;
const SECRET_PATTERN =
  /\b(password|passcode|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret)\b(\s*[:=]\s*)([^\s,;]+)/gi;

/**
 * Removes common high-confidence personal identifiers and credentials before text leaves the
 * LMS for an external AI provider. Names are deliberately not guessed because that would
 * corrupt ordinary lesson prose and still be unreliable.
 */
export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(GOVERNMENT_ID_PATTERN, '[redacted-id]')
    .replace(IP_ADDRESS_PATTERN, '[redacted-ip]')
    .replace(COMPACT_PHONE_PATTERN, '[redacted-phone]')
    .replace(FORMATTED_PHONE_PATTERN, '[redacted-phone]')
    .replace(LONG_NUMBER_PATTERN, '[redacted-number]')
    .replace(SECRET_PATTERN, (_match, label: string, separator: string) => `${label}${separator}[redacted-secret]`);
}
