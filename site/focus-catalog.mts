import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/catalog';

/** The three spatial catalogues the world draws as dots, served at `/catalogues/<id>.json` (`site/pages/catalogues/[id].json.ts`). */
export async function loadFocusCatalogs(origin: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const rows = await Promise.all((['galaxies', 'clusters', 'nebulae'] as const).map(async id => {
    const url = new URL(`/catalogues/${id}.json`, origin);
    const response = await fetcher(url, { redirect: 'error', signal: signal ?? AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Prepared focus catalogue ${url.pathname} failed: HTTP ${response.status}.`);
    return { id, data: await response.json() as unknown };
  }));
  return { galaxies: parsePreparedGalaxyCatalog(rows.find(row => row.id === 'galaxies')?.data),
    clusters: parsePreparedClusterCatalog(rows.find(row => row.id === 'clusters')?.data),
    nebulae: parsePreparedNebulaCatalog(rows.find(row => row.id === 'nebulae')?.data) };
}
