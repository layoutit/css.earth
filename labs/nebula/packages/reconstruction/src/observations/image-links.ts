import type { ArchiveImage } from './model.ts';

/** Firefly's documented URL API loads the exact archive product in IRSA's browser viewer. */
function viewer(url: string, mode: 'image' | 'table', title: string) {
  const target = new URL('https://irsa.ipac.caltech.edu/irsaviewer/');
  target.searchParams.set('api', mode); target.searchParams.set(mode === 'image' ? 'url' : 'source', url); target.searchParams.set('title', title);
  return target.href;
}
export function isFitsUrl(value: string) {
  const url = new URL(value), paths = [url.pathname, ...['uri', 'file', 'filename'].map(key => url.searchParams.get(key) ?? '')];
  return paths.some(path => /\.(?:fits?|fts)(?:\.(?:gz|fz))?$/i.test(path));
}
function isDataLink(value: string) { return /\/datalink(?:\/|$)/i.test(new URL(value).pathname); }
export function imageLinks(image: ArchiveImage) {
  const format = image.accessFormat ?? '', title = image.title || image.id;
  const fits = image.accessUrl && (/\b(?:x-)?fits\b/i.test(format) || isFitsUrl(image.accessUrl)) ? image.accessUrl : null;
  const table = image.accessUrl && (/datalink|votable/i.test(format) || isDataLink(image.accessUrl)) ? image.accessUrl : null;
  const preview = image.previewUrl && !isFitsUrl(image.previewUrl) && !isDataLink(image.previewUrl) ? image.previewUrl : null;
  const viewUrl = preview ?? (fits ? viewer(fits, 'image', title) : null);
  // Old cached records sometimes stored the download endpoint as their Source URL.
  // Adapt those at the presentation boundary; preserve their acquisition receipts unchanged.
  const sourceIsFits = isFitsUrl(image.sourceUrl) || image.sourceUrl === fits;
  const sourceIsTable = isDataLink(image.sourceUrl) || image.sourceUrl === table;
  const sourceUrl = sourceIsFits ? viewer(image.sourceUrl, 'image', title) : sourceIsTable ? viewer(image.sourceUrl, 'table', title) : image.sourceUrl;
  const filesUrl = table ? viewer(table, 'table', title) : null;
  return { sourceUrl, viewUrl, filesUrl, downloadUrl: table ? null : image.accessUrl, fits: Boolean(fits),
    sourceLabel: sourceIsTable ? 'File listing' : sourceIsFits ? 'View FITS' : 'Source record',
    sourceIsViewer: Boolean(sourceIsFits || sourceIsTable) };
}
