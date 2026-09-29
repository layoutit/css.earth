import { sourceId, sourceText } from '@cssearth/objects/sources';
import type { DatasetHost, DatasetRoutes } from '@cssearth/objects/provenance';

/** The application route that shows the context objects (the Sun's scene); preparation records it for each context package. */
export const CONTEXT_ROUTE = '/sun/';

/** An object's lens is selected on its own page, a scene's or a catalogue focus's alike. */
export function datasetDestination(objectId: string, route: string, lensId: string): string {
  sourceId(objectId); sourceId(lensId);
  if (route !== `/${objectId}/`) throw new TypeError(`Invalid dataset object route ${route} for ${objectId}: an object's lens is on its own page.`);
  return `${route}?dataset=${encodeURIComponent(lensId)}`;
}

/** Exact canonical URLs reject cross-object links, duplicate parameters and external destinations; a hosted lens's URL is its
 * host dataset's. */
export function parseDatasetDestination(value: unknown, ownerId: string, ownerLensId: string, host?: DatasetHost): string {
  const href = sourceText(value);
  const expected = host ? datasetDestination(host.objectId, `/${host.objectId}/`, host.lensId) : datasetDestination(ownerId, `/${ownerId}/`, ownerLensId);
  if (href !== expected) throw new TypeError(`Invalid dataset destination URL ${href} for ${ownerId}/${ownerLensId}; expected ${expected}.`);
  return href;
}

/** The application's dataset routes, which the provenance compilers and parsers in `@cssearth/objects/provenance` take. Marked
 * pure so a client bundle that only reads URLs drops it. */
export const DATASET_ROUTES: DatasetRoutes = /* @__PURE__ */ Object.freeze({ destination: datasetDestination, parse: parseDatasetDestination });
