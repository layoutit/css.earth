import { parseDatasetDestination } from '../src/platform/dataset-destination.mts';

/** Prepared source links select their focused object directly on the shared camera. */
export function isFocusDatasetUrl(url: URL): boolean {
  const objectId = url.searchParams.get('focus'), lensId = url.searchParams.get('focusLens');
  if (!objectId || !lensId) return false;
  try { parseDatasetDestination(`${url.pathname}${url.search}${url.hash}`, objectId, lensId); return true; }
  catch { return false; }
}

/** Query selections work on the server; previously shared fragments remain valid. */
export function readDatasetUrl(url: URL): { requested: boolean; id: string | null } {
  const fields = url.hash.slice(1).split('&').filter(field => field.startsWith('dataset='));
  const query = url.searchParams.getAll('dataset');
  if (!fields.length && !query.length) return { requested: false, id: null };
  if (fields.length + query.length !== 1) throw new TypeError('The dataset link contains more than one dataset.');
  let id: string;
  try { id = query[0] ?? decodeURIComponent(fields[0].slice('dataset='.length)); }
  catch { throw new TypeError('The dataset link is malformed.'); }
  if (!id || /[\u0000-\u001f]/.test(id)) throw new TypeError('The dataset link is malformed.');
  return { requested: true, id };
}

export function withDataset(url: URL, id: string | null): URL {
  const next = new URL(url);
  const legacy = !next.searchParams.has('dataset') && next.hash.slice(1).split('&').some(field => field.startsWith('dataset='));
  const fields = next.hash.slice(1).split('&').filter(field => field && !field.startsWith('dataset='));
  next.searchParams.delete('dataset');
  if (id !== null) {
    if (legacy) fields.push(`dataset=${encodeURIComponent(id)}`);
    else next.searchParams.set('dataset', id);
  }
  next.hash = fields.join('&');
  return next;
}

export function datasetHref(route: string, lensId: string): string {
  return `${route}?dataset=${encodeURIComponent(lensId)}`;
}
