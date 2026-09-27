/** Rewrite native form requests in place. No rendering or index work runs at the edge. */
export default function searchRoute(request: Request): URL | undefined {
  const url = new URL(request.url);
  if (!['q', 'dataset', 'settings', 'feature', 'v', 'focus', 'focusLens', 'overview'].some(name => url.searchParams.has(name))) return;
  const objectId = url.pathname === '/' ? 'earth' : /^\/([a-z][a-z0-9-]*)\/?$/u.exec(url.pathname)?.[1];
  if (!objectId) return;
  url.pathname = '/.netlify/functions/search';
  url.searchParams.set('object', objectId);
  return url;
}
