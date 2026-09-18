import { sourceId, sourceText } from './source-catalog.mts';

/** Only these two application routes may select a prepared object's dataset. */
export function datasetDestination(objectId: string, route: string, lensId: string): string {
  sourceId(objectId); sourceId(lensId);
  if (route === `/${objectId}/`) return `${route}?dataset=${encodeURIComponent(lensId)}`;
  if (route === `/sun/?focus=${encodeURIComponent(objectId)}`) return `${route}&focusLens=${encodeURIComponent(lensId)}`;
  throw new TypeError('Invalid dataset object route.');
}

/** Where a prepared object's lens is reached: its own dataset, or, for a volume attached to a body, the body's dataset that
 * shows it. An attached volume is no place of its own, so it never gets a destination of its own. */
export function objectDataset(object: { readonly id: string; readonly name: string; readonly route: string;
  readonly hostedBy?: { readonly objectId: string; readonly name: string; readonly route: string; readonly datasets: Readonly<Record<string, { readonly lensId: string; readonly label: string }>> } },
  lens: { readonly id: string; readonly label: string }) {
  const hosted = object.hostedBy;
  if (hosted === undefined) return { objectId: object.id, objectName: object.name, lensId: lens.id, label: lens.label, href: datasetDestination(object.id, object.route, lens.id) };
  const dataset = hosted.datasets[lens.id];
  if (dataset === undefined) throw new TypeError(`No dataset of ${hosted.objectId} shows ${object.id}/${lens.id}.`);
  return { objectId: object.id, objectName: hosted.name, lensId: lens.id, label: dataset.label, href: datasetDestination(hosted.objectId, hosted.route, dataset.lensId),
    host: { objectId: hosted.objectId, lensId: dataset.lensId } };
}

/** The body dataset a hosted lens is reached through. */
export interface DatasetHost { readonly objectId: string; readonly lensId: string }

/** Exact canonical URLs reject cross-object links, duplicate parameters and external destinations; a hosted lens's URL is its
 * host dataset's. */
export function parseDatasetDestination(value: unknown, ownerId: string, ownerLensId: string, host?: DatasetHost): string {
  const objectId = host?.objectId ?? ownerId, lensId = host?.lensId ?? ownerLensId;
  const href = sourceText(value);
  if (href !== datasetDestination(objectId, `/${objectId}/`, lensId) && href !== `/${objectId}/#dataset=${encodeURIComponent(lensId)}` &&
      href !== datasetDestination(objectId, `/sun/?focus=${encodeURIComponent(objectId)}`, lensId)) {
    throw new TypeError('Invalid dataset destination URL.');
  }
  return href;
}
