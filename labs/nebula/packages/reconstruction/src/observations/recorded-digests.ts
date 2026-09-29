/**
 * Recipes, catalogues and receipts name their files by path. A recorded file digest is a retired field: it is
 * refused where it appears, never silently ignored, so an old record is rewritten instead of half-trusted.
 */
const retired = /sha256/i;

/** Throw if any key anywhere under `value` records a file digest; the error names the record, field and value. */
export function refuseRecordedDigests(value: unknown, record: string, at = ''): void {
  if (Array.isArray(value)) { value.forEach((item, index) => refuseRecordedDigests(item, record, `${at}[${index}]`)); return; }
  if (value === null || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    const field = at ? `${at}.${key}` : key;
    if (retired.test(key)) throw new TypeError(`${record}: ${field} records a file digest ${JSON.stringify(item)}; name the file by path instead.`);
    refuseRecordedDigests(item, record, field);
  }
}
