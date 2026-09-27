import { sourceId, sourceText } from '@cssearth/objects/sources';
import type { DatasetHost, DatasetRoutes } from '@cssearth/objects/provenance';

/** Only these two application routes may select a prepared object's dataset. */
export function datasetDestination(objectId: string, route: string, lensId: string): string {
  sourceId(objectId); sourceId(lensId);
  if (route === `/${objectId}/`) return `${route}?dataset=${encodeURIComponent(lensId)}`;
  if (route === `/sun/?focus=${encodeURIComponent(objectId)}`) return `${route}&focusLens=${encodeURIComponent(lensId)}`;
  throw new TypeError('Invalid dataset object route.');
}

/** Exact canonical URLs reject cross-object links, duplicate parameters and external destinations; a hosted lens's URL is its
 * host dataset's. */
export function parseDatasetDestination(value: unknown, ownerId: string, ownerLensId: string, host?: DatasetHost): string {
  const objectId = host?.objectId ?? ownerId, lensId = host?.lensId ?? ownerLensId;
  const href = sourceText(value);
  if (href !== datasetDestination(objectId, `/${objectId}/`, lensId) &&
      href !== datasetDestination(objectId, `/sun/?focus=${encodeURIComponent(objectId)}`, lensId)) {
    throw new TypeError('Invalid dataset destination URL.');
  }
  return href;
}

/** The application's dataset routes, which the provenance compilers and parsers in `@cssearth/objects/provenance` take. Marked
 * pure so a client bundle that only reads URLs drops it. */
export const DATASET_ROUTES: DatasetRoutes = /* @__PURE__ */ Object.freeze({ destination: datasetDestination, parse: parseDatasetDestination });
