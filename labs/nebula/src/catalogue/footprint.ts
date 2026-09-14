import type { ArchiveImage, MessierObject } from './types';

type Point = readonly [number, number];
const radians = Math.PI / 180;
/** Gnomonic coordinates about the target; RA wrap and rotated footprints are preserved. */
function project(ra: number, dec: number, object: MessierObject): Point | null {
  const delta = (ra - object.raDegrees) * radians, d = dec * radians, center = object.decDegrees * radians;
  const denominator = Math.sin(center) * Math.sin(d) + Math.cos(center) * Math.cos(d) * Math.cos(delta);
  if (denominator <= 0) return null;
  return [Math.cos(d) * Math.sin(delta) / denominator,
    (Math.cos(center) * Math.sin(d) - Math.sin(center) * Math.cos(d) * Math.cos(delta)) / denominator];
}
function edgeDistance(a: Point, b: Point) {
  const x = b[0] - a[0], y = b[1] - a[1], length = x * x + y * y;
  const t = length ? Math.max(0, Math.min(1, -(a[0] * x + a[1] * y) / length)) : 0;
  return Math.hypot(a[0] + t * x, a[1] + t * y);
}
/** Unknown STC-S frames/shapes remain unknown, never assumed to cover the target. */
export function footprintCoverage(image: ArchiveImage, object: MessierObject, majorArcsec: number | null) {
  const match = image.footprint?.trim().match(/^POLYGON\s+(?:ICRS|J2000)\s+(.+)$/i);
  if (!match) return { center: null, referenceExtent: null };
  const coordinates = match[1]!.trim().split(/\s+/).map(Number);
  if (coordinates.length < 6 || coordinates.length % 2 || coordinates.some(value => !Number.isFinite(value))) return { center: null, referenceExtent: null };
  const points: Point[] = [];
  for (let index = 0; index < coordinates.length; index += 2) {
    const ra = coordinates[index]!, dec = coordinates[index + 1]!;
    if (ra < 0 || ra > 360 || Math.abs(dec) > 90) return { center: null, referenceExtent: null };
    const point = project(ra, dec, object); if (!point) return { center: null, referenceExtent: null }; points.push(point);
  }
  let inside = false, distance = Infinity;
  for (let index = 0; index < points.length; index++) {
    const a = points[index]!, b = points[(index + 1) % points.length]!;
    distance = Math.min(distance, edgeDistance(a, b));
    if ((a[1] > 0) !== (b[1] > 0) && a[0] - a[1] * (b[0] - a[0]) / (b[1] - a[1]) > 0) inside = !inside;
  }
  const center = inside || distance < 1e-10;
  const radius = majorArcsec === null ? null : Math.tan(majorArcsec / 7200 * radians);
  return { center, referenceExtent: radius === null ? null : center && distance >= radius };
}
