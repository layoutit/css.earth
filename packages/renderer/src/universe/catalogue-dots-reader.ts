import { decodeCatalogueDots, type PreparedCatalogueDots } from '@cssearth/objects';
import { fetchPreparedBank, preparedReader } from '../prepared-data/prepared-readers.js';

/** The catalogue's dots (`/catalogues/dots.bin`, @cssearth/objects catalogue-dots.ts): read and checked where they are
 * fetched, their places handed over by transfer. */
export const catalogueDotsReader = preparedReader<PreparedCatalogueDots>('catalogue-dots', async (url, fetcher) => {
  const dots = decodeCatalogueDots(await fetchPreparedBank(url, fetcher), url);
  return { value: dots, transfer: [dots.positionsM.buffer as ArrayBuffer] };
});
