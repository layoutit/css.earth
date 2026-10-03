import { convexWindowEdges } from '@cssearth/core';
/** Offline authored sky-footprint selection; this is not a measured physical boundary. */
export interface EmissionWindow {
  sourceId: string;
  /** Convex footprint in the shared [xWest, yNorth] arcsecond frame, either winding. */
  polygonArcsec: [number, number][];
  /** Smooth inward taper; emission is exactly zero on and outside the footprint. */
  featherArcsec: number;
  interpretation: string;
}
export function readEmissionWindow(value: unknown): EmissionWindow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid emission window.');
  const record = value as Record<string, unknown>, polygon = record.polygonArcsec;
  if (Object.keys(record).some(key => !['sourceId', 'polygonArcsec', 'featherArcsec', 'interpretation'].includes(key)) ||
      typeof record.sourceId !== 'string' || !record.sourceId.trim() || typeof record.interpretation !== 'string' || !record.interpretation.trim() ||
      typeof record.featherArcsec !== 'number' || !Number.isFinite(record.featherArcsec) || record.featherArcsec < 0 ||
      !Array.isArray(polygon) || polygon.length !== 4 || polygon.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)))
    throw new TypeError('Invalid emission window.');
  const points = polygon.map((point: [number, number]): [number, number] => [point[0], point[1]]);
  for (const axis of [0, 1]) {
    const span = Math.max(...points.map(point => point[axis])) - Math.min(...points.map(point => point[axis]));
    if (!(span > 0) || !Number.isFinite(span)) throw new TypeError('Invalid emission window bounds.');
  }
  convexWindowEdges(points);
  return { sourceId: record.sourceId, polygonArcsec: points, featherArcsec: record.featherArcsec, interpretation: record.interpretation };
}
