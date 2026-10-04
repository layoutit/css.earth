import type { PreparedReaderDefinition, PreparedReading } from './prepared-readers.js';
import { cssVolumeReader, volumeStarsReader } from '../volume/prepared-volume-readers.js';
import { cataloguePointsReader } from '../universe/catalogue-point-reader.js';
import { catalogueDotsReader } from '../universe/catalogue-dots-reader.js';

/** The reader of every prepared format, by the kind of file it reads. A new format adds its reader here. */
const READERS: ReadonlyMap<string, PreparedReaderDefinition> = new Map(
  ([cssVolumeReader, volumeStarsReader, cataloguePointsReader, catalogueDotsReader] as readonly PreparedReaderDefinition[]).map(reader => [reader.kind, reader] as const));

/** Read `url` with the reader of `kind`, on this thread: the data worker in a browser, the caller's own in Node. */
export function readPreparedHere(kind: string, url: string, fetcher: typeof fetch = fetch): Promise<PreparedReading> {
  const reader = READERS.get(kind);
  if (!reader) return Promise.reject(new TypeError(`No prepared reader is defined for ${kind} (${url}).`));
  return reader.read(url, fetcher);
}
