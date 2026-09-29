import { objectIdAtPath } from '../root-object.mts';

/** Rewrite native form requests in place. No rendering or index work runs at the edge. */
export default function searchRoute(request: Request): URL | undefined {
  const url = new URL(request.url);
  if (!['q', 'dataset', 'settings', 'feature', 'v', 'overview'].some(name => url.searchParams.has(name))) return;
  const objectId = objectIdAtPath(url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`);
  if (!objectId) return;
  url.pathname = '/.netlify/functions/search';
  url.searchParams.set('object', objectId);
  return url;
}
