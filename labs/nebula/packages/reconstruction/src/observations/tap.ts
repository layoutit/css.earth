export interface TapTable { rows: Record<string, unknown>[]; overflow: boolean }
/** Asks an archive's TAP service one query and returns its rows by lower-case column name. The host supplies it (the lab's PyVO
 * adapter); this package asks no archive and reads no VOTable itself. */
export type AskTap = (endpoint: string, query: string, maxRecords: number) => Promise<TapTable>;

/** The same query as a link a browser opens. */
export function tapUrl(endpoint: string, query: string, maxRecords: number): URL {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'json', MAXREC: String(maxRecords), QUERY: query }).toString();
  return url;
}
