import { decodeVolumeStars, validatePreparedCssVolume, type PreparedCataloguePoints, type PreparedCssVolume } from '@cssearth/objects';
import { fetchPreparedBank, fetchPreparedJson, preparedReader } from '../prepared-data/prepared-readers.js';

/** One dataset's volume of a dataset bank (`<dataset>/volume.json`), validated where it is read. */
export const cssVolumeReader = preparedReader<PreparedCssVolume>('css-volume', async (url, fetcher) => ({ value: validatePreparedCssVolume(await fetchPreparedJson(url, fetcher)), transfer: [] }));

/** A dataset bank's catalogue stars (`stars.bin`): columns in the file, the points a mount draws on arrival. */
export const volumeStarsReader = preparedReader<PreparedCataloguePoints>('volume-stars', async (url, fetcher) => ({ value: decodeVolumeStars(await fetchPreparedBank(url, fetcher), url), transfer: [] }));
