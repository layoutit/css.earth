import { parsePointTransmission } from '@cssearth/objects';
import { fetchPreparedBank, preparedReader } from '../../prepared-data/prepared-readers.js';
export const pointTransmissionReader = preparedReader('point-transmission', async (url,fetcher) => {
  const value=parsePointTransmission(await fetchPreparedBank(url,fetcher));
  return {value,transfer:[...new Set([value.tau.buffer,value.colors.buffer])] as ArrayBuffer[]};
});
