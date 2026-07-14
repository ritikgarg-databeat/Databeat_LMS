/**
 * Hand-rolled RFC 4180 CSV serialization for the reports module's exports.
 *
 * Deliberately NOT a new npm dependency: the only CSV package in this project is `csv-parse`
 * (used by the groups bulk-import), which — as its name says — only parses. Serializing is a
 * ~30-line, fully-specified problem (RFC 4180 §2), so a dependency would buy nothing but
 * supply-chain surface.
 */

/** Everything a report row cell may hold; see `toCsv` for how each variant is stringified. */
export type CsvCell = string | number | boolean | Date | null | undefined;

/**
 * UTF-8 byte-order mark, prepended to every generated CSV. Excel (the overwhelmingly common
 * consumer of these exports) sniffs encoding when opening a .csv and, WITHOUT a BOM, assumes
 * the local ANSI code page — mangling any non-ASCII trainee/course name (é, ü, ₹, …). The BOM
 * makes Excel decode the file as UTF-8; every other consumer (Sheets, pandas, `csv-parse`)
 * either ignores or strips it.
 */
const UTF8_BOM = '\uFEFF';

/** `Date` → ISO 8601 (UTC); `null`/`undefined` → empty cell; everything else via `String()`. */
function stringifyCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  return String(cell);
}

/**
 * CSV/formula-injection guard (OWASP): a cell whose first character is `=`, `+`, `-`, `@`, or a
 * tab is a formula trigger in Excel/Sheets/LibreOffice when the file is opened. Every cell in
 * this module is built from data an end user can set (a trainee's own name via `PATCH
 * /users/me`, course/group titles, etc.) and is read by a MORE privileged user (trainer/admin)
 * exporting the CSV — so this isn't optional hardening, it's a real privilege-crossing vector.
 * Prefixing a leading `'` neutralizes the formula in every major spreadsheet app while staying
 * human-readable (Excel shows the apostrophe-prefixed text as plain text, not as `'=...`).
 */
function neutralizeFormulaPrefix(value: string): string {
  return /^[=+\-@\t]/.test(value) ? `'${value}` : value;
}

/**
 * RFC 4180 §2.6–2.7: a cell containing a comma, double quote, CR, or LF must be wrapped in
 * double quotes, with embedded double quotes doubled. Anything else passes through verbatim.
 * Formula-injection neutralization (see `neutralizeFormulaPrefix`) runs first so a quoted cell's
 * leading `'` is preserved as ordinary content, not re-interpreted.
 */
function escapeCell(value: string): string {
  const safe = neutralizeFormulaPrefix(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Serializes a header row plus data rows into a single RFC 4180 CSV string: CRLF record
 * separators (§2.1) and a leading UTF-8 BOM (see `UTF8_BOM`). Rows shorter/longer than the
 * header are emitted as-is — callers are responsible for shaping rows to the header contract.
 */
export function toCsv(headers: string[], rows: ReadonlyArray<ReadonlyArray<CsvCell>>): string {
  const records = [headers as ReadonlyArray<CsvCell>, ...rows].map((row) =>
    row.map((cell) => escapeCell(stringifyCell(cell))).join(','),
  );
  return `${UTF8_BOM}${records.join('\r\n')}\r\n`;
}

/**
 * `${base}-YYYY-MM-DD.csv` (UTC date), with `base` lowercased and sanitized to `[a-z0-9-]` so
 * the result is always safe inside a `Content-Disposition: attachment; filename="…"` header.
 */
export function csvFilename(base: string): string {
  const safeBase =
    base
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report';
  const utcDate = new Date().toISOString().slice(0, 10);
  return `${safeBase}-${utcDate}.csv`;
}
