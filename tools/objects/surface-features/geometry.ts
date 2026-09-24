import type { Vector3, SurfaceFeatureAxes, SurfaceFeatureOutline } from './catalog.js';


/** Same map convention as the shell minimap: texture u wraps east from the map's left edge. */
export function surfaceDirection(longitudeDeg: number, latitudeDeg: number, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number): readonly [number, number, number] {
  const u = (((longitudeDeg - mapLeftEdgeLongitudeDeg) % 360) + 360) % 360 / 360;
  const longitude = u * 2 * Math.PI, latitude = latitudeDeg * Math.PI / 180;
  const component = (i: number) => Math.cos(latitude) * (axes.prime[i]! * Math.cos(longitude) + axes.east[i]! * Math.sin(longitude)) + axes.north[i]! * Math.sin(latitude);
  return [component(0), component(1), component(2)];
}


export const round = (value: number, digits = 6) => Number(value.toFixed(digits));

const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const scaled = (v: Vector3, s: number, digits = 3): Vector3 => [round(v[0] * s, digits), round(v[1] * s, digits), round(v[2] * s, digits)];

/** Prepared boundary circle: centre pulled towards the body centre by cos θ, spanned by two tangents scaled to R·sin θ. */
export function rimVectors(direction: Vector3, north: Vector3, meshRadius: number, radiusUnits: number): Extract<SurfaceFeatureOutline, { kind: 'circle' }> {
  const theta = Math.min(Math.PI / 2, radiusUnits / meshRadius);
  let east = cross(north, direction);
  let length = Math.hypot(...east);
  if (length < 1e-6) { east = cross([1, 0, 0], direction); length = Math.hypot(...east); }
  east = [east[0] / length, east[1] / length, east[2] / length];
  const tangentNorth = cross(direction, east);
  const span = meshRadius * Math.sin(theta);
  return { kind: 'circle', center: scaled(direction, meshRadius * Math.cos(theta)), east: scaled(east, span), north: scaled(tangentNorth, span) };
}


/** The Gazetteer extent box as a closed polygon: pieces/4 samples along each latitude- or longitude-parallel edge. */
export function extentPolygon(box: { minLon: number; maxLon: number; minLat: number; maxLat: number }, axes: SurfaceFeatureAxes, mapLeftEdgeLongitudeDeg: number, meshRadius: number, pieces: number): Extract<SurfaceFeatureOutline, { kind: 'box' }> {
  const perEdge = Math.max(1, Math.floor(pieces / 4)), points: Vector3[] = [];
  const corners: readonly [number, number][] = [[box.minLon, box.minLat], [box.maxLon, box.minLat], [box.maxLon, box.maxLat], [box.minLon, box.maxLat]];
  for (let edge = 0; edge < 4; edge++) {
    const [lon0, lat0] = corners[edge]!, [lon1, lat1] = corners[(edge + 1) % 4]!;
    for (let step = 0; step < perEdge; step++) {
      const t = step / perEdge;
      points.push(scaled(surfaceDirection(lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t, axes, mapLeftEdgeLongitudeDeg), meshRadius));
    }
  }
  return { kind: 'box', points };
}


/** Gazetteer extents may wrap the meridian or use negative longitudes; keep the box centred near its feature. */
export function normalizeExtent(row: { minLon: number; maxLon: number; minLat: number; maxLat: number }, centerLon: number) {
  let { minLon, maxLon } = row;
  if (maxLon < minLon) maxLon += 360;
  const mid = (minLon + maxLon) / 2, shift = Math.round((centerLon - mid) / 360) * 360;
  minLon += shift; maxLon += shift;
  if (!(maxLon - minLon <= 360) || row.maxLat < row.minLat) throw new TypeError('Gazetteer extent is inconsistent.');
  return { minLon, maxLon, minLat: row.minLat, maxLat: row.maxLat };
}


/** Farthest intersection of the ray from the mesh origin along `direction` with the triangle list (Möller–Trumbore), or null when it misses. */
export function projectRadial(triangles: readonly (readonly (readonly number[])[])[], direction: Vector3): number | null {
  let best: number | null = null;
  for (const [a, b, c] of triangles) {
    const e1 = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!], e2 = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!];
    const p = [direction[1] * e2[2]! - direction[2] * e2[1]!, direction[2] * e2[0]! - direction[0] * e2[2]!, direction[0] * e2[1]! - direction[1] * e2[0]!];
    const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, t = [-a![0]!, -a![1]!, -a![2]!];
    const u = (t[0]! * p[0]! + t[1]! * p[1]! + t[2]! * p[2]!) * inv;
    if (u < 0 || u > 1) continue;
    const q = [t[1]! * e1[2]! - t[2]! * e1[1]!, t[2]! * e1[0]! - t[0]! * e1[2]!, t[0]! * e1[1]! - t[1]! * e1[0]!];
    const v = (direction[0] * q[0]! + direction[1] * q[1]! + direction[2] * q[2]!) * inv;
    if (v < 0 || u + v > 1) continue;
    const distance = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) * inv;
    if (distance > 0 && (best === null || distance > best)) best = distance;
  }
  return best;
}


/** The radius band every cast point can occupy: the farthest vertex and the nearest point of any face (a flat face sags below its vertices). */
export function meshRadiusBand(triangles: readonly (readonly (readonly number[])[])[]): { minimum: number; maximum: number } {
  let minimum = Number.POSITIVE_INFINITY, maximum = 0;
  for (const [a, b, c] of triangles) {
    for (const point of [a!, b!, c!]) maximum = Math.max(maximum, Math.hypot(point[0]!, point[1]!, point[2]!));
    minimum = Math.min(minimum, originToTriangle(a!, b!, c!));
  }
  if (!(minimum > 0) || !(maximum >= minimum)) throw new TypeError('Surface hit mesh has no positive radius band.');
  return { minimum: round(minimum, 3), maximum: round(maximum, 3) };
}

/** Distance from the origin to the closest point of triangle abc (Ericson, Real-Time Collision Detection 5.1.5). */
function originToTriangle(a: readonly number[], b: readonly number[], c: readonly number[]): number {
  const sub = (p: readonly number[], q: readonly number[]) => [p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!];
  const dot = (p: readonly number[], q: readonly number[]) => p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!;
  const ab = sub(b, a), ac = sub(c, a), ap = [-a[0]!, -a[1]!, -a[2]!];
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return Math.hypot(...a);
  const bp = [-b[0]!, -b[1]!, -b[2]!], d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return Math.hypot(...b);
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return Math.hypot(a[0]! + v * ab[0]!, a[1]! + v * ab[1]!, a[2]! + v * ab[2]!); }
  const cp = [-c[0]!, -c[1]!, -c[2]!], d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return Math.hypot(...c);
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return Math.hypot(a[0]! + w * ac[0]!, a[1]! + w * ac[1]!, a[2]! + w * ac[2]!); }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return Math.hypot(b[0]! + w * (c[0]! - b[0]!), b[1]! + w * (c[1]! - b[1]!), b[2]! + w * (c[2]! - b[2]!)); }
  const denominator = 1 / (va + vb + vc), v = vb * denominator, w = vc * denominator;
  return Math.hypot(a[0]! + ab[0]! * v + ac[0]! * w, a[1]! + ab[1]! * v + ac[1]! * w, a[2]! + ab[2]! * v + ac[2]! * w);
}
