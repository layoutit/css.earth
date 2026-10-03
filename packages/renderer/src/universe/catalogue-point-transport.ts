import { decodeCatalogueBankBinary } from '@cssearth/objects';
import { readPreparedBinary } from '../prepared-data/prepared-binary.js';

/** A prepared bank's JSON, refusing an unsuccessful answer. */
export async function fetchPreparedJson(target: string): Promise<unknown> {
  const response = await fetch(target);
  if (!response.ok) throw new Error(`${target} answered ${response.status}.`);
  return response.json() as Promise<unknown>;
}
/** A published catalogue point bank (`<id>.bin`): packed, gunzipped by the platform and decoded to the object its JSON
 * was (@cssearth/objects prepared-data/catalogue-bank-binary.ts), refusing an unsuccessful answer. */
export async function fetchPreparedCatalogueBank(target: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const response = await fetcher(target);
  if (!response.ok) throw new Error(`${target} answered ${response.status}.`);
  return decodeCatalogueBankBinary(await readPreparedBinary(await response.arrayBuffer(), target), target);
}
