/** Target tables describe code-owned behavior, never values learned from recorded answers.
 * Vite preview: CORS precedes plugins; searchServer handles FIND_PATH and page rewrites only.
 * Vite's bundled sirv handles ranges/ETag, but not If-Modified-Since; final middleware sends 404.
 * Handler targets: find.mts, search-response.mts, report.ts and cloudflare/worker.ts.
 * Worker static types: host.mts's offline ASSETS adapter (not provider HTTP behavior).
 */
import { type Target, type AnswerRequest, object } from './model.mts';
export interface Expectation { status: number; type: string | null }
const json = 'application/json', html = 'text/html', text = 'text/plain';
const handler: Readonly<Record<string, Expectation>> = {
  ...Object.fromEntries(['missing', 'invalid', 'offset', 'place', 'both'].map(id => [`find-${id}`, { status: 400, type: json }])),
  ...Object.fromEntries(['valid', 'empty', 'huge', 'get', 'head'].map(id => [`find-${id}`, { status: 200, type: json }])),
  'find-place-numeric': { status: 404, type: json },
  ...Object.fromEntries(['offset-positive', 'illustrations', 'second-features'].map(id => [`find-${id}`, { status: 200, type: json }])),
  ...Object.fromEntries(['bad-feature', 'unknown-feature', 'missing-dataset', 'bad-settings', 'duplicate-view'].map(id => [`search-${id}`, { status: 400, type: text }])),
  'search-unknown-object': { status: 404, type: null },
  'earth-query-head': { status: 200, type: html }, 'earth-query-post': { status: 405, type: text },
  ...Object.fromEntries(['options', 'post'].map(id => [`find-${id}`, { status: 405, type: text }])),
  ...Object.fromEntries(['missing', 'empty', 'invalid'].map(id => [`search-${id}`, { status: 404, type: text }])),
  ...Object.fromEntries(['get', 'head', 'dataset', 'settings', 'feature', 'shared', 'huge'].map(id => [`search-${id}`, { status: 200, type: html }])),
  ...Object.fromEntries(['options', 'post'].map(id => [`search-${id}`, { status: 405, type: text }])),
  ...Object.fromEntries(['get', 'head', 'options'].map(id => [`report-${id}`, { status: 405, type: null }])),
  ...Object.fromEntries(['post', 'empty', 'huge'].map(id => [`report-${id}`, { status: 204, type: null }])),
};
export const targetTables: Readonly<Record<Target, Readonly<Record<string, Expectation>>>> = {
  netlify: { ...handler, robots: { status: 200, type: text }, sitemap: { status: 200, type: 'application/xml' }, 'missing-page': { status: 404, type: null }, 'missing-file': { status: 404, type: null }, 'static-range': { status: 206, type: 'text/javascript' }, 'static-range-invalid': { status: 416, type: null }, 'static-etag': { status: 304, type: null }, 'static-modified': { status: 304, type: null }, prepared: { status: 200, type: json }, 'prepared-range': { status: 200, type: json } },
  cloudflare: { ...handler, 'cloudflare-www': { status: 301, type: null }, robots: { status: 200, type: text }, sitemap: { status: 200, type: 'application/xml' }, 'missing-page': { status: 404, type: null }, 'missing-file': { status: 404, type: null } },
  preview: {
    ...handler,
    ...Object.fromEntries(Object.keys(handler).filter(id => id.startsWith('search-') || id.startsWith('report-')).map(id => [id, { status: id.endsWith('-options') ? 204 : 404, type: null }])),
    'find-options': { status: 204, type: null },
    'static-range': { status: 206, type: 'text/javascript' },
    'static-range-invalid': { status: 416, type: null },
    'static-etag': { status: 304, type: null },
    'static-modified': { status: 200, type: 'text/javascript' },
    prepared: { status: 200, type: json }, 'prepared-range': { status: 200, type: json },
    robots: { status: 200, type: text }, sitemap: { status: 200, type: 'text/xml' },
    'missing-page': { status: 404, type: null }, 'missing-file': { status: 404, type: null },
  },
};
/** Expand the fixed protocol table over registry-derived page ids. Unknown requests fail closed. */
export function expectation(target: Target, value: unknown): Expectation {
  const request = object(value);
  if (typeof request.id !== 'string') throw new Error('Missing request id');
  const fixed = targetTables[target][request.id];
  if (fixed) return fixed;
  if (request.html || request.id.endsWith('-navigation')) return { status: 200, type: html };
  if (request.id.endsWith('-first-view')) return { status: 200, type: json };
  throw new Error(`No ${target} expectation for ${request.id}`);
}
export function expectationTable(target: Target, requests: AnswerRequest[]): Record<string, Expectation> {
  return Object.fromEntries(requests.map(request => [request.id, expectation(target, request)]));
}
