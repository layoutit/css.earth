import { drawnPageFromUrl } from './navigation/navigation-scope.mts';

/** The mounted scene's own dataset. On the page of a level the scene draws the scene reads none: that page's `dataset` is
 * the level's own (page-datasets.mts). */
export function readSceneDatasetUrl(url: URL, sceneId: string): { requested: boolean; id: string | null } {
  return drawnPageFromUrl(url, sceneId) === null ? readDatasetUrl(url) : { requested: false, id: null };
}

/** Writes the mounted scene's dataset, except on the page of a subject the scene draws (navigation-scope.mts withPage). */
export function withSceneDataset(url: URL, sceneId: string, id: string | null): URL {
  return drawnPageFromUrl(url, sceneId) === null ? withDataset(url, id) : new URL(url);
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

export function datasetHref(route: string, datasetId: string): string {
  return `${route}?dataset=${encodeURIComponent(datasetId)}`;
}
