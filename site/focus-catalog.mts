import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { record, requiredElement } from './browser-types.mts';
import type { PreparedCatalogObject } from '@cssearth/catalog';

export function readInitialFocus(document: Document): PreparedCatalogObject | null {
  const script = document.querySelector('script[data-initial-focus]');
  if (!script) return null;
  const value: unknown = JSON.parse(script.textContent ?? '');
  if (!record(value)) throw new TypeError('Initial focus is invalid.');
  const catalog = value.schema === 'cssearth-nebula-catalog@1' ? parsePreparedNebulaCatalog(value)
    : value.schema === 'cssearth-cluster-catalog@1' ? parsePreparedClusterCatalog(value) : parsePreparedGalaxyCatalog(value);
  if (catalog.objects.length !== 1) throw new TypeError('Initial focus must identify one prepared record.');
  return catalog.objects[0];
}

export async function loadFocusCatalogs(document: Document, origin: string, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const value: unknown = JSON.parse(requiredElement(document, 'script[data-focus-catalogs]').textContent ?? '');
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError('Prepared focus catalogues are missing.');
  const rows = await Promise.all(value.map(async input => {
    if (!record(input) || !['galaxies', 'clusters', 'nebulae'].includes(String(input.id)) ||
      input.url !== `/catalogues/${input.id}.json` || typeof input.bytes !== 'number' || !Number.isSafeInteger(input.bytes) || input.bytes <= 0 ||
      typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(input.sha256)) throw new TypeError('Invalid prepared focus catalogue pin.');
    const response = await fetcher(new URL(String(input.url), origin), { redirect: 'error', signal: signal ?? AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error('Prepared focus catalogue could not load.');
    const bytes = await response.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    if (bytes.byteLength !== input.bytes || digest !== input.sha256) throw new TypeError('Prepared focus catalogue identity drifted.');
    return { id: input.id, data: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  }));
  if (new Set(rows.map(row => row.id)).size !== 3) throw new TypeError('Prepared focus catalogue identities are duplicated.');
  return { galaxies: parsePreparedGalaxyCatalog(rows.find(row => row.id === 'galaxies')?.data),
    clusters: parsePreparedClusterCatalog(rows.find(row => row.id === 'clusters')?.data),
    nebulae: parsePreparedNebulaCatalog(rows.find(row => row.id === 'nebulae')?.data) };
}
