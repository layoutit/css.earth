/** A ring in a plane of its own inside a published-profile disc: the inner ring of a disc a multiple star has broken, whose
 * paper gives it a tilt and a line of nodes that are not the outer disc's.
 *
 * The image says where the ring is on the sky; the paper says which plane it lies in. So the ring's share of each sight line
 * is read from the image, and only its depth comes from the plane:
 *
 * 1. `measureTiltedRing` takes the image's median brightness in circles about the ring's published sky centre. That profile
 *    rises to the ring's ridge and falls to the gap beyond it. The gap's lowest level is the outer disc's light there, and the
 *    ring's light is what stands above that level, out to where the level is reached. No threshold is chosen.
 * 2. `tiltedRingDensity` puts that light on the ring's plane, which holds the star (the focus of an eccentric ring), with a
 *    stated Gaussian thickness. It is scaled so that its sight-line integral stands to the outer disc's as the two brightnesses
 *    do, and the disc-aligned grid then normalises every column to the image, as it does for the disc alone.
 *
 * The outer disc's profile is measured on the image less the ring's light, so no light is drawn twice. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { alignDiscGrid, type NormalisedColumns } from './disc-aligned-grid.mts';
import type { DiscModel, SkyPlane } from './disc-envelope.mts';

const DEG = Math.PI / 180;

export interface TiltedRing {
  readonly citation: string; readonly url: string;
  /** Inclination from face-on and the position angle of the line of nodes, degrees, as `DiscModel` states them. */
  readonly inclinationDeg: number; readonly positionAngleDeg: number;
  /** Which end of the minor axis is nearer the observer: its position angle, and where that is published. */
  readonly nearSidePositionAngleDeg: number; readonly nearSideSource: string;
  /** The ring's centre on the sky from the star, arcseconds east and north, and where it is published. */
  readonly skyCentreArcsec: readonly [number, number]; readonly skyCentreSource: string;
  /** The ring's Gaussian height above its plane, in units, and the published model it comes from. */
  readonly heightUnits: number; readonly heightSource: string;
}

export function parseTiltedRing(value: unknown, label: string): TiltedRing {
  const r = requireRecord(value, label), centre = requireArray(r.skyCentreArcsec, `${label} skyCentreArcsec`).map(v => requireFiniteNumber(v, `${label} skyCentreArcsec`));
  const ring: TiltedRing = { citation: requireString(r.citation, `${label} citation`), url: requireString(r.url, `${label} url`),
    inclinationDeg: requireFiniteNumber(r.inclinationDeg, `${label} inclinationDeg`), positionAngleDeg: requireFiniteNumber(r.positionAngleDeg, `${label} positionAngleDeg`),
    nearSidePositionAngleDeg: requireFiniteNumber(r.nearSidePositionAngleDeg, `${label} nearSidePositionAngleDeg`), nearSideSource: requireString(r.nearSideSource, `${label} nearSideSource`),
    skyCentreArcsec: [centre[0]!, centre[1]!], skyCentreSource: requireString(r.skyCentreSource, `${label} skyCentreSource`),
    heightUnits: requireFiniteNumber(r.heightUnits, `${label} heightUnits`), heightSource: requireString(r.heightSource, `${label} heightSource`) };
  if (centre.length !== 2 || !(ring.inclinationDeg >= 0 && ring.inclinationDeg < 90) || !(ring.heightUnits > 0)) throw new RangeError(`${label}: a tilted ring has a sky centre, an inclination under 90 degrees and a positive height.`);
  return ring;
}

/** The unit normal of a plane in the sky basis (east, north, toward the observer), with the stated side nearer. */
export function planeNormal(plane: Pick<TiltedRing, 'inclinationDeg' | 'positionAngleDeg' | 'nearSidePositionAngleDeg'>): readonly [number, number, number] {
  const phi = plane.positionAngleDeg * DEG, i = plane.inclinationDeg * DEG, near = Math.cos((plane.nearSidePositionAngleDeg - plane.positionAngleDeg - 90) * DEG) >= 0 ? 1 : -1;
  return [-near * Math.cos(phi) * Math.sin(i), near * Math.sin(phi) * Math.sin(i), Math.cos(i)];
}
/** The angle between two planes, degrees. */
export function mutualTiltDeg(a: Parameters<typeof planeNormal>[0], b: Parameters<typeof planeNormal>[0]): number {
  const p = planeNormal(a), q = planeNormal(b);
  return Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))) / DEG;
}

export interface TiltedRingMeasure {
  /** The ring's sky centre in the plane's units: x west, y north. */
  readonly centreUnits: readonly [number, number];
  /** Median brightness in circles about that centre, one sample every grid step. */
  readonly profile: readonly { readonly radiusUnits: number; readonly median: number }[];
  /** Where the profile peaks, where the gap beyond it is lowest, and that lowest level, the outer disc's light there. */
  readonly ridgeUnits: number; readonly endsUnits: number; readonly gapLevel: number; readonly ridgeOverNoise: number;
  /** The ring's light at a sky-plane point: the profile above the gap level, out to the gap's lowest point. */
  readonly brightness: (x: number, y: number) => number;
}

/** Measure the ring on the image. `limitUnits` is how far from its centre the gap is searched: the outer disc's reference radius. */
export function measureTiltedRing(sky: SkyPlane, ring: TiltedRing, arcsecPerUnit: number, limitUnits: number): TiltedRingMeasure {
  const { size, halfUnits, step, plane, noise } = sky, cx = -ring.skyCentreArcsec[0] / arcsecPerUnit, cy = ring.skyCentreArcsec[1] / arcsecPerUnit;
  const count = Math.floor(limitUnits / step), bins = Array.from({ length: count }, () => [] as number[]);
  if (count < 8) throw new RangeError('The tilted ring is searched over fewer than eight grid steps.');
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const v = plane[j * size + i]!, k = Math.floor(Math.hypot(-halfUnits + (i + 0.5) * step - cx, -halfUnits + (j + 0.5) * step - cy) / step);
    if (Number.isFinite(v) && k < count) bins[k]!.push(v);
  }
  const profile = bins.map((values, k) => { values.sort((a, b) => a - b); return { radiusUnits: (k + 0.5) * step, median: values.length ? values[values.length >> 1]! : NaN }; });
  // The ridge is the brightest circle that is not the centre itself, where dust beside the stars is unresolved.
  let ridge = 2; for (let k = 3; k < count; k++) if (profile[k]!.median > profile[ridge]!.median) ridge = k;
  let ends = ridge; for (let k = ridge + 1; k < count; k++) if (profile[k]!.median < profile[ends]!.median) ends = k;
  if (ends === ridge || ends === count - 1) throw new Error(`The tilted ring's profile has no gap inside ${limitUnits} units of its centre.`);
  const gapLevel = Math.max(0, profile[ends]!.median), endsUnits = profile[ends]!.radiusUnits;
  const brightness = (x: number, y: number) => {
    const s = Math.hypot(x - cx, y - cy);
    if (s >= endsUnits) return 0;
    const f = s / step - 0.5, k = Math.max(0, Math.min(count - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - k));
    return Math.max(0, profile[k]!.median * (1 - t) + profile[k + 1]!.median * t - gapLevel);
  };
  return { centreUnits: [cx, cy], profile, ridgeUnits: profile[ridge]!.radiusUnits, endsUnits, gapLevel, ridgeOverNoise: profile[ridge]!.median / noise, brightness };
}

/** Density of the ring at a sky-plane point, z toward the observer, on the scale of the outer disc's `profileDiscDensity`: its
 * sight-line integral stands to the disc's as the ring's brightness stands to the disc's profile. */
export function tiltedRingDensity(ring: TiltedRing, measure: TiltedRingMeasure, outer: Pick<DiscModel, 'gaussianHeightUnits' | 'inclinationDeg'>): (x: number, y: number, z: number) => number {
  const normal = planeNormal(ring), h = ring.heightUnits;
  const scale = (outer.gaussianHeightUnits / Math.cos(outer.inclinationDeg * DEG)) / (h / Math.cos(ring.inclinationDeg * DEG));
  return (x, y, z) => {
    const light = measure.brightness(x, y);
    if (!(light > 0)) return 0;
    const height = -x * normal[0] + y * normal[1] + z * normal[2];
    return light * scale * Math.exp(-((height / h) ** 2) / 2);
  };
}

/** The standard normal distribution's share below `v` (Abramowitz & Stegun 7.1.26, to 1.5e-7). */
function normalBelow(v: number): number {
  const x = Math.abs(v) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return v >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** The share of the ring's light that a grid of half height `halfHeightUnits` about another plane through the star leaves
 * out. The ring's light is drawn out to where its gap is lowest, well past its ridge, and that faint skirt climbs away from
 * the other plane: each sky sample's light, with its Gaussian thickness, is counted where it lies farther than the grid is tall. */
export function ringLightBeyond(sky: Pick<SkyPlane, 'size' | 'halfUnits' | 'step'>, ring: TiltedRing, measure: TiltedRingMeasure,
  other: Parameters<typeof planeNormal>[0], halfHeightUnits: number): number {
  const n = planeNormal(ring), o = planeNormal(other), spread = ring.heightUnits * Math.abs(o[2] / n[2]), { size, halfUnits, step } = sky;
  let total = 0, beyond = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, light = measure.brightness(x, y);
    if (!(light > 0)) continue;
    // Where the sight line crosses the ring's plane, and how far that point is from the other plane.
    const z = -(-x * n[0] + y * n[1]) / n[2], height = -x * o[0] + y * o[1] + z * o[2];
    total += light;
    beyond += light * (1 - (normalBelow((halfHeightUnits - height) / spread) - normalBelow((-halfHeightUnits - height) / spread)));
  }
  return total > 0 ? beyond / total : 0;
}

/** How far the ring's ridge, with three of its heights, reaches above and below another plane through the star, in units:
 * the grid's half height must hold it. The ring's faint skirt beyond the ridge may pass it (`ringLightBeyond`). */
export function reachAbovePlane(ring: TiltedRing, measure: TiltedRingMeasure, other: Parameters<typeof planeNormal>[0]): number {
  const n = planeNormal(ring), o = planeNormal(other), [cx, cy] = measure.centreUnits;
  let reach = 0;
  for (let a = 0; a < 360; a++) {
    // A point of the ring's ridge on the sky, lifted onto the ring's plane, and its height above the other plane.
    const x = cx + measure.ridgeUnits * Math.cos(a * DEG), y = cy + measure.ridgeUnits * Math.sin(a * DEG), z = -(-x * n[0] + y * n[1]) / n[2];
    reach = Math.max(reach, Math.abs(-x * o[0] + y * o[1] + z * o[2]));
  }
  return reach + 3 * ring.heightUnits;
}

/** The ring's own grid, for a disc drawn as sheets: aligned with the ring's plane through the star, out to where the ring's
 * light ends in that plane, and six of its heights tall, the least `alignDiscGrid` takes. It holds the ring's `share` of
 * each column; `columns` are the sky columns normalised by the whole `density`. The bake cuts it into the recipe's
 * sheets, as the disc's grid. */
export function tiltedRingGrid(sky: Pick<SkyPlane, 'size' | 'halfUnits' | 'step'>, channels: readonly Float32Array[], density: (x: number, y: number, z: number) => number,
  ring: TiltedRing, measure: Pick<TiltedRingMeasure, 'endsUnits' | 'centreUnits'>, share: (x: number, y: number, z: number) => number, columns: NormalisedColumns) {
  const reachUnits = (measure.endsUnits + Math.hypot(...measure.centreUnits)) / Math.cos(ring.inclinationDeg * DEG) + 3 * ring.heightUnits;
  return alignDiscGrid(sky, channels, density, { inclinationDeg: ring.inclinationDeg, positionAngleDeg: ring.positionAngleDeg,
    nearSidePositionAngleDeg: ring.nearSidePositionAngleDeg, centreUnits: [0, 0], gaussianHeightUnits: ring.heightUnits },
  6 * ring.heightUnits, { weight: share, planarHalfUnits: Math.min(sky.halfUnits, reachUnits), columns });
}
