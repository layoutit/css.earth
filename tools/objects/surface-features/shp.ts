/** Minimal ESRI shapefile reader for polyline records (shape type 3), enough for a pinned
 * tectonic-map archive. Coordinates are returned exactly as stored; callers project them. */
export interface ShpPolyline { readonly index: number; readonly parts: readonly (readonly (readonly [number, number])[])[]; }

const POLYLINE = 3, NULL_SHAPE = 0;

export function parseShpPolylines(bytes: Uint8Array): { readonly shapeType: number; readonly records: readonly (ShpPolyline | null)[] } {
  if (bytes.length < 100) throw new TypeError('Shapefile header is truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getInt32(0, false) !== 9994) throw new TypeError('Shapefile magic number is invalid.');
  const fileLength = view.getInt32(24, false) * 2, shapeType = view.getInt32(32, true);
  if (fileLength > bytes.length) throw new TypeError('Shapefile is truncated.');
  if (shapeType !== POLYLINE) throw new TypeError(`Shapefile type ${shapeType} is not a polyline layer.`);
  const records: (ShpPolyline | null)[] = [];
  let offset = 100;
  while (offset + 8 <= fileLength) {
    const contentLength = view.getInt32(offset + 4, false) * 2;
    const start = offset + 8, end = start + contentLength;
    if (end > fileLength) throw new TypeError('Shapefile record is truncated.');
    const type = view.getInt32(start, true);
    if (type === NULL_SHAPE) records.push(null);
    else if (type !== POLYLINE) throw new TypeError('Shapefile mixes shape types.');
    else {
      const partCount = view.getInt32(start + 36, true), pointCount = view.getInt32(start + 40, true);
      if (partCount < 1 || pointCount < 2) throw new TypeError('Shapefile polyline is empty.');
      const partsOffset = start + 44, pointsOffset = partsOffset + 4 * partCount;
      if (pointsOffset + 16 * pointCount > end) throw new TypeError('Shapefile polyline exceeds its record.');
      const starts: number[] = [];
      for (let part = 0; part < partCount; part++) starts.push(view.getInt32(partsOffset + 4 * part, true));
      const parts: (readonly [number, number])[][] = [];
      for (let part = 0; part < partCount; part++) {
        const from = starts[part]!, to = part + 1 < partCount ? starts[part + 1]! : pointCount;
        if (from < 0 || to > pointCount || to - from < 2) throw new TypeError('Shapefile part bounds are invalid.');
        const points: (readonly [number, number])[] = [];
        for (let index = from; index < to; index++) {
          const x = view.getFloat64(pointsOffset + 16 * index, true), y = view.getFloat64(pointsOffset + 16 * index + 8, true);
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Shapefile coordinate is not finite.');
          points.push([x, y]);
        }
        parts.push(points);
      }
      records.push({ index: records.length, parts });
    }
    offset = end;
  }
  return { shapeType, records };
}
