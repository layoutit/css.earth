import { parseDatasetDestination } from '../src/platform/dataset-destination.mts';
import { preparedFocusFromUrl } from './navigation/navigation-scope.mts';

/** Prepared source links select their focused object directly on the shared camera of scene `sceneId`. */
export function isFocusDatasetUrl(url: URL, sceneId: string): boolean {
  const objectId = preparedFocusFromUrl(url, sceneId), lensId = url.searchParams.get('dataset');
  if (!objectId || !lensId) return false;
  try { parseDatasetDestination(`${url.pathname}${url.search}${url.hash}`, objectId, lensId); return true; }
  catch { return false; }
}

/** The mounted scene's own dataset. On a catalogue focus's page `dataset` is the focus's lens, so the scene reads none. */
export function readSceneDatasetUrl(url: URL, sceneId: string): { requested: boolean; id: string | null } {
  return preparedFocusFromUrl(url, sceneId) === null ? readDatasetUrl(url) : { requested: false, id: null };
}

/** Writes the mounted scene's dataset, except on a catalogue focus's page, whose `dataset` is the focus's lens. */
export function withSceneDataset(url: URL, sceneId: string, id: string | null): URL {
  return preparedFocusFromUrl(url, sceneId) === null ? withDataset(url, id) : new URL(url);
}

/** Dataset selections are canonical query parameters. */
export function readDatasetUrl(url: URL): { requested: boolean; id: string | null } {
  const query = url.searchParams.getAll('dataset');
  if (!query.length) return { requested: false, id: null };
  if (query.length !== 1) throw new RangeError('The dataset link contains more than one dataset.');
  const id = query[0];
  if (!id || !/^[a-z][a-z0-9-]*$/u.test(id) || id.length > 128) throw new RangeError('The dataset link is malformed.');
  return { requested: true, id };
}

export function withDataset(url: URL, id: string | null): URL {
  const next = new URL(url);
  if (id === null) next.searchParams.delete('dataset');
  else next.searchParams.set('dataset', id);
  return next;
}

export function datasetHref(route: string, lensId: string): string {
  return `${route}?dataset=${encodeURIComponent(lensId)}`;
}
