import { readCloudPoints, readCloudSegments, PREPARED_CLOUD_POINTS_SCHEMA, PREPARED_CLOUD_SEGMENTS_SCHEMA, type PreparedCloudPoints, type PreparedCloudSegments } from '@cssearth/objects';
import { basisSpansSpace } from '@cssearth/engine';
import { fetchPreparedBank, preparedReader } from '../../prepared-data/prepared-readers.js';

/** A dataset's overlay bank, read: billboards (cloud-points.ts) or lines (cloud-segments.ts), by its schema. */
export type CloudOverlayData = { readonly kind: 'points'; readonly points: PreparedCloudPoints } | { readonly kind: 'segments'; readonly lines: PreparedCloudSegments };

/** An overlay bank (`<id>.bin`): fetched, unpacked and checked where it is read, and handed over with its columns' buffers
 * by transfer (each buffer once: the columns may be views of one). */
export const cloudOverlayReader = preparedReader<CloudOverlayData>('cloud-overlay', async (url, fetcher) => {
  const bank = await fetchPreparedBank(url, fetcher);
  const value: CloudOverlayData = bank.schema === PREPARED_CLOUD_POINTS_SCHEMA ? { kind: 'points', points: readCloudPoints(bank, url) }
    : bank.schema === PREPARED_CLOUD_SEGMENTS_SCHEMA ? { kind: 'segments', lines: readCloudSegments(bank, url) }
    : (() => { throw new TypeError(`${url}: an overlay is ${PREPARED_CLOUD_POINTS_SCHEMA} or ${PREPARED_CLOUD_SEGMENTS_SCHEMA}, not ${bank.schema}.`); })();
  // an occluder dims what is behind it only if its axes span space: a flat or zero axis has no inside (cloud-occluder.ts)
  const occluder = value.kind === 'points' ? value.points.occluder : value.lines.occluder;
  if (!occluder.every(e => basisSpansSpace(e.axesUnits))) throw new TypeError(`${url}: every occluder's axes span space.`);
  const columns = value.kind === 'points' ? [value.points.positions, value.points.diameters, value.points.cells] : [value.lines.from, value.lines.to, value.lines.rgba, value.lines.heads];
  return { value, transfer: [...new Set(columns.map(column => column.buffer as ArrayBuffer))] };
});
