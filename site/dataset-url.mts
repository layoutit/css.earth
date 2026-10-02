/** The mounted scene's own dataset. */
export function readSceneDatasetUrl(url: URL, _sceneId: string): { requested: boolean; id: string | null } {
  return readDatasetUrl(url);
}

/** Writes the mounted scene's dataset. */
export function withSceneDataset(url: URL, _sceneId: string, id: string | null): URL {
  return withDataset(url, id);
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
