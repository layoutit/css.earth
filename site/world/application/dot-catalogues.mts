import type { PreparedCatalogueDots } from '@cssearth/objects';
import { readPrepared } from '@cssearth/renderer';

/** The dots the world draws from the galaxy catalogue, served at `/catalogues/dots.bin` (`site/pages/catalogues/dots.bin.ts`)
 * and read by the data worker: the page's thread fetches and parses no catalogue. */
export function loadCatalogueDots(origin: string, read: <Value>(kind: string, url: string) => Promise<Value> = readPrepared): Promise<PreparedCatalogueDots> {
  return read<PreparedCatalogueDots>('catalogue-dots', new URL('/catalogues/dots.bin', origin).href);
}
