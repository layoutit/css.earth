import { decodePreparedBank, type PreparedBank } from '@cssearth/objects';
import { readPreparedBinary } from './prepared-binary.js';

/**
 * The one way the page reads a prepared data file. A reader is named by the kind of file it reads: it fetches the file,
 * unpacks and validates it, and returns the value the page mounts with the buffers that travel by transfer. In a browser
 * the readers run in the data worker (prepared-data-worker.ts), so the page's thread parses no large text and validates
 * nothing; Node tools and tests call the same reader in place.
 */
export interface PreparedReading<Value = unknown> { readonly value: Value; readonly transfer: readonly Transferable[] }
export type PreparedReader<Value = unknown> = (url: string, fetcher: typeof fetch) => Promise<PreparedReading<Value>>;

async function answer(url: string, fetcher: typeof fetch): Promise<Response> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
  return response;
}

/** A packed bank (@cssearth/objects prepared-bank.ts) from its address: gunzipped by the platform, unshuffled, decoded. */
export async function fetchPreparedBank(url: string, fetcher: typeof fetch = fetch): Promise<PreparedBank> {
  return decodePreparedBank(await readPreparedBinary(await (await answer(url, fetcher)).arrayBuffer(), url), url);
}

/** A prepared JSON file from its address. */
export async function fetchPreparedJson(url: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const text = await (await answer(url, fetcher)).text();
  try { return JSON.parse(text) as unknown; } catch (cause) { throw new TypeError(`${url} is not valid JSON.`, { cause }); }
}

const readers = new Map<string, PreparedReader>();

/** Register the reader of one kind of file. A module that owns a format registers its reader as it loads, on whichever
 * thread it loads: the data worker's entry imports them all. */
export function definePreparedReader<Value>(kind: string, reader: PreparedReader<Value>): (url: string, fetcher?: typeof fetch) => Promise<PreparedReading<Value>> {
  if (readers.has(kind)) throw new TypeError(`Prepared reader ${kind} is defined twice.`);
  readers.set(kind, reader);
  return (url, fetcher = fetch) => reader(url, fetcher);
}

/** Read `url` with the reader of `kind`, on this thread. */
export function readPreparedHere(kind: string, url: string, fetcher: typeof fetch = fetch): Promise<PreparedReading> {
  const reader = readers.get(kind);
  if (!reader) return Promise.reject(new TypeError(`No prepared reader is defined for ${kind} (${url}).`));
  return reader(url, fetcher);
}
