/** Rewrite native form requests in place. No rendering or index work runs at the edge. */
export default function searchRoute(request: Request): URL | undefined {
  const url = new URL(request.url);
  if (!url.searchParams.has('q')) return;
  const objectId = url.pathname === '/' ? 'earth' : /^\/([a-z][a-z0-9-]*)\/?$/u.exec(url.pathname)?.[1];
  if (!objectId) return;
  url.pathname = '/.netlify/functions/search';
  url.searchParams.set('object', objectId);
  return url;
}
