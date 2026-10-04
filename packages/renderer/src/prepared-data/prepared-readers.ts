import { decodePreparedBank, type PreparedBank } from '@cssearth/objects';
import { readPreparedBinary } from './prepared-binary.js';

/**
 * The one way the page reads a prepared data file. A reader is named by the kind of file it reads: it fetches the file,
 * unpacks and validates it, and returns the value the page mounts with the buffers that travel by transfer. In a browser
 * the readers run in the data worker (prepared-data-worker.ts), so the page's thread parses no large text and validates
 * nothing; Node tools and tests call the same reader in place (readers.ts).
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

/** The reader of one kind of file, named by that kind. The module that owns a format declares its reader, and
 * readers.ts lists them all: nothing is registered as a module loads, so no bundler can drop one. */
export interface PreparedReaderDefinition<Value = unknown> { readonly kind: string; readonly read: PreparedReader<Value> }
export const preparedReader = <Value>(kind: string, read: PreparedReader<Value>): PreparedReaderDefinition<Value> => ({ kind, read });
