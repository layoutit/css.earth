import { record } from './browser-types.mts';

/** Search named features, cities included, on the server. The browser sends its query and receives the rows to show:
 * it never downloads the cross-body index (3.3 MB) or a body's places catalogue (Earth's is 14.8 MB).
 *
 *   GET /.netlify/functions/find?q=<query>&object=<body id>   { results: FindResult[] }
 *   GET /.netlify/functions/find?place=<id>&object=<body id>   { place: <the catalogue record> }
 */
export const FIND_PATH = '/.netlify/functions/find';
export const FIND_QUERY_LIMIT = 200;
export interface FindResult { readonly objectId: string; readonly id: string; readonly name: string; readonly context: string; readonly label: string; readonly href: string; readonly lensIds?: readonly string[]; }

export function parseFindResults(value: unknown): FindResult[] {
  if (!record(value) || !Array.isArray(value.results)) throw new TypeError('Find response is invalid.');
  return value.results.map(result => {
    if (!record(result) || ['objectId', 'id', 'name', 'context', 'label', 'href'].some(key => typeof result[key] !== 'string') ||
        (result.lensIds !== undefined && (!Array.isArray(result.lensIds) || !result.lensIds.every(id => typeof id === 'string')))) throw new TypeError('Find result is invalid.');
    return result as unknown as FindResult;
  });
}
