/** The reserved dataset fragment shares the URL with existing unrelated anchors. */
export function readDatasetUrl(url: URL): { requested: boolean; id: string | null } {
  const fields = url.hash.slice(1).split('&').filter(field => field.startsWith('dataset='));
  if (!fields.length) return { requested: false, id: null };
  if (fields.length !== 1) throw new TypeError('The dataset link contains more than one dataset.');
  let id: string;
  try { id = decodeURIComponent(fields[0].slice('dataset='.length)); }
  catch { throw new TypeError('The dataset link is malformed.'); }
  if (!id || /[\u0000-\u001f]/.test(id)) throw new TypeError('The dataset link is malformed.');
  return { requested: true, id };
}

export function withDataset(url: URL, id: string | null): URL {
  const next = new URL(url);
  const fields = next.hash.slice(1).split('&').filter(field => field && !field.startsWith('dataset='));
  if (id !== null) fields.push(`dataset=${encodeURIComponent(id)}`);
  next.hash = fields.join('&');
  return next;
}

export function datasetHref(route: string, lensId: string): string {
  return `${route}#dataset=${encodeURIComponent(lensId)}`;
}
