/** Archive tables and DataLink answers, asked and decoded by PyVO through the telescope's bridge (`tap-query`, `vo-links`): the
 * lab builds no TAP request and reads no VOTable itself. Node only; the commands pass these to the catalogue code that needs them. */
import { astroquery, type AstroqueryAnswer, type AstroqueryRequest } from '@cssearth/telescope/node';
import type { AskTap } from '@cssearth/nebula-reconstruction/observations/tap';

type Ask = (request: Extract<AstroqueryRequest, { operation: 'tap-query' }>) => Promise<AstroqueryAnswer>;
/** `endpoint` is the service's synchronous address, as the catalogue records and links it; PyVO takes the service itself.
 * An answer the service cut short is returned with `overflow`, never as a complete table. */
export const archiveTableWith = (ask: Ask): AskTap => async (endpoint, query, maxRecords) => {
  const answer = await ask({ operation: 'tap-query', service: endpoint.replace(/\/sync\/?$/u, ''), query, maxrec: maxRecords });
  if (!answer.rows || !answer.tap) throw new TypeError('Archive returned no table.');
  const rows = answer.rows.map(row => {
    const names = Object.keys(row).map(name => name.toLowerCase());
    if (new Set(names).size !== names.length) throw new TypeError('Duplicate archive columns.');
    // A VOTable has no null for text, so an absent string arrives empty; the catalogue keeps absent values null.
    return Object.fromEntries(Object.entries(row).map(([name, value]) => [name.toLowerCase(), value === '' ? null : value]));
  });
  return { rows, overflow: !answer.tap.complete };
};
export const archiveTable: AskTap = archiveTableWith(astroquery);

/** One DataLink answer as PyVO read it: the links table's columns and rows, and what the request returned. */
export interface DataLinkAnswer { queryStatus: string; fields: readonly { name: string; unit: string | null }[]; rows: readonly Readonly<Record<string, unknown>>[];
  resolvedUrl: string; httpStatus: number; responseBytes: number }
export type AskLinks = (url: string) => Promise<DataLinkAnswer>;
type AskVo = (request: Extract<AstroqueryRequest, { operation: 'vo-links' }>) => Promise<AstroqueryAnswer>;
const LINKS_BYTE_LIMIT = 2 * 1024 * 1024;
/** The bridge keeps each answer as the archive sent it under `directory`, which must exist, and refuses one over 2 MiB. */
export const archiveLinksWith = (ask: AskVo) => (directory: string): AskLinks => async url => {
  const vo = (await ask({ operation: 'vo-links', url, directory, byteLimit: LINKS_BYTE_LIMIT })).vo;
  if (!vo) throw new TypeError('Archive returned no DataLink table.');
  return { queryStatus: vo.queryStatus, fields: vo.fields.map(({ name, unit }) => ({ name, unit })), rows: vo.rows,
    resolvedUrl: vo.effectiveUrl, httpStatus: vo.httpStatus, responseBytes: vo.raw.bytes };
};
export const archiveLinks = archiveLinksWith(astroquery);
