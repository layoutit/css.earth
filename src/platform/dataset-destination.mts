import { sourceId, sourceText } from './source-catalog.mts';

/** Only these two application routes may select a prepared object's dataset. */
export function datasetDestination(objectId: string, route: string, lensId: string): string {
  sourceId(objectId); sourceId(lensId);
  if (route === `/${objectId}/`) return `${route}#dataset=${encodeURIComponent(lensId)}`;
  if (route === `/sun/?focus=${encodeURIComponent(objectId)}`) return `${route}&focusLens=${encodeURIComponent(lensId)}`;
  throw new TypeError('Invalid dataset object route.');
}

/** Exact canonical URLs reject cross-object links, duplicate parameters and external destinations. */
export function parseDatasetDestination(value: unknown, objectId: string, lensId: string): string {
  const href = sourceText(value);
  if (href !== datasetDestination(objectId, `/${objectId}/`, lensId) &&
      href !== datasetDestination(objectId, `/sun/?focus=${encodeURIComponent(objectId)}`, lensId)) {
    throw new TypeError('Invalid dataset destination URL.');
  }
  return href;
}
