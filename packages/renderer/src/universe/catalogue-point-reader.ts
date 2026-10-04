import { cataloguePointColumnBuffers, readCataloguePointColumns, type PreparedCataloguePointColumns } from '@cssearth/objects';
import { fetchPreparedBank, preparedReader } from '../prepared-data/prepared-readers.js';

/** A published catalogue point bank (`<id>.bin`): fetched, unpacked and checked where it is read, and handed over as its
 * columns (@cssearth/objects catalogue-point-columns.ts), their buffers by transfer. */
export const cataloguePointsReader = preparedReader<PreparedCataloguePointColumns>('catalogue-points', async (url, fetcher) => {
  const bank = readCataloguePointColumns(await fetchPreparedBank(url, fetcher), url);
  return { value: bank, transfer: cataloguePointColumnBuffers(bank) as ArrayBuffer[] };
});
