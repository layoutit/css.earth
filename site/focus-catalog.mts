import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { record } from './browser-types.mts';
import type { PreparedCatalogObject, PreparedGalaxyCatalog, PreparedClusterCatalog, PreparedNebulaCatalog } from '@cssearth/catalog';

type PreparedFocusCatalog = PreparedGalaxyCatalog | PreparedClusterCatalog | PreparedNebulaCatalog;

/** Keep the selected record and its complete physical-host chain in a native-navigation fragment. */
export function initialFocusCatalog(catalog: PreparedFocusCatalog, selected: PreparedCatalogObject): PreparedFocusCatalog {
  if (!catalog.objects.some(object => object === selected || object.id === selected.id)) throw new TypeError('Initial focus is outside its catalogue.');
  if (catalog.schema !== 'cssearth-galaxy-catalog@1') {
    const value = { ...catalog, objects: [selected] };
    return catalog.schema === 'cssearth-cluster-catalog@1' ? parsePreparedClusterCatalog(value) : parsePreparedNebulaCatalog(value);
  }
  const positioned = new Map(catalog.objects.map(object => [object.id, object]));
  const unpositioned = new Map((catalog.unpositionedHosts ?? []).map(object => [object.id, object]));
  const included = new Set<string>();
  let current: { readonly id: string; readonly hostId?: string } | undefined = positioned.get(selected.id);
  while (current) {
    if (included.has(current.id)) throw new TypeError(`Cyclic physical host: ${current.id}.`);
    included.add(current.id);
    if (current.hostId === undefined) break;
    const hostId = current.hostId;
    current = positioned.get(hostId) ?? unpositioned.get(hostId);
    if (!current) throw new TypeError(`Unknown physical host: ${hostId}.`);
  }
  return parsePreparedGalaxyCatalog({ ...catalog,
    objects: catalog.objects.filter(object => included.has(object.id)),
    unpositionedHosts: (catalog.unpositionedHosts ?? []).filter(object => included.has(object.id)),
  });
}

export function readInitialFocus(document: Document): PreparedCatalogObject | null {
  const script = document.querySelector('script[data-initial-focus]');
  if (!script) return null;
  const selectedId = script.getAttribute('data-initial-focus');
  if (!selectedId || !/^[a-z0-9][a-z0-9:._+-]{0,127}$/iu.test(selectedId)) throw new TypeError('Initial focus identity is invalid.');
  const value: unknown = JSON.parse(script.textContent ?? '');
  if (!record(value)) throw new TypeError('Initial focus is invalid.');
  const catalog = value.schema === 'cssearth-nebula-catalog@1' ? parsePreparedNebulaCatalog(value)
    : value.schema === 'cssearth-cluster-catalog@1' ? parsePreparedClusterCatalog(value) : parsePreparedGalaxyCatalog(value);
  const selected = catalog.objects.find(object => object.id === selectedId);
  if (!selected) throw new TypeError('Initial focus identity names no prepared record.');
  return selected;
}

/** The three prepared focus catalogues, served at `/catalogues/<id>.json` (`site/pages/catalogues/[id].json.ts`). */
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
