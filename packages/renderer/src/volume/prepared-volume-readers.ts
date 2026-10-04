import { decodeVolumeStars, validatePreparedCssVolume, type PreparedCataloguePoints, type PreparedCssVolume } from '@cssearth/objects';
import { definePreparedReader, fetchPreparedBank, fetchPreparedJson } from '../prepared-data/prepared-readers.js';

/** One dataset's volume of a dataset bank (`<dataset>/volume.json`), validated where it is read. */
export const PREPARED_CSS_VOLUME_READER = 'css-volume';
definePreparedReader<PreparedCssVolume>(PREPARED_CSS_VOLUME_READER, async (url, fetcher) => ({ value: validatePreparedCssVolume(await fetchPreparedJson(url, fetcher)), transfer: [] }));

/** A dataset bank's catalogue stars (`stars.bin`): columns in the file, the points a mount draws on arrival. */
export const PREPARED_VOLUME_STARS_READER = 'volume-stars';
definePreparedReader<PreparedCataloguePoints>(PREPARED_VOLUME_STARS_READER, async (url, fetcher) => ({ value: decodeVolumeStars(await fetchPreparedBank(url, fetcher), url), transfer: [] }));
