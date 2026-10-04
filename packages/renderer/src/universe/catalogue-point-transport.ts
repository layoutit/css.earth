import type { PreparedCataloguePointColumns } from '@cssearth/objects';
import { readPrepared } from '../prepared-data-worker-client.js';
import { readPreparedHere } from '../prepared-data/readers.js';
import { cataloguePointsReader } from './catalogue-point-reader.js';

/** A prepared bank's JSON, refusing an unsuccessful answer. */
export async function fetchPreparedJson(target: string): Promise<unknown> {
  const response = await fetch(target);
  if (!response.ok) throw new Error(`${target} answered ${response.status}.`);
  return response.json() as Promise<unknown>;
}
/** A published catalogue point bank (`<id>.bin`) as its columns, read by the data worker (catalogue-point-reader.ts): the
 * page's thread fetches, unpacks and checks nothing. Where there is no worker (Node tools, tests) the same reader runs in
 * place, through `fetcher`. */
export function fetchPreparedCatalogueBank(target: string, fetcher: typeof fetch = fetch): Promise<PreparedCataloguePointColumns> {
  if (typeof Worker === 'undefined') return readPreparedHere(cataloguePointsReader.kind, target, fetcher).then(reading => reading.value as PreparedCataloguePointColumns);
  return readPrepared<PreparedCataloguePointColumns>(cataloguePointsReader.kind, target);
}
