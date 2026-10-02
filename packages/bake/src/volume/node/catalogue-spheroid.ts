import { createHash } from 'node:crypto';

const PC_M = 3.0856775814913673e16;
/** The steps a sight line through the spheroid is weighed in. */
const DEPTH_STEPS = 400;

/** A published Sérsic fit as a recipe's `frame.spheroid` gives it. Despite its name `distancePc` is what the recipes have
 * always written: the distance in parsecs. */
export interface CatalogueSpheroid { readonly centerRaDeg: number; readonly centerDecDeg: number; readonly distancePc: number;
  readonly halfLightRadiusKpc: number; readonly sersicIndex: number; readonly axisRatio: number; readonly axisPositionAngleDeg: number;
  readonly cutoffHalfLightRadii: number }

/** A recipe's `frame.spheroid`: the fit's numbers, with the `source` and `basis` that say whose they are. */
export function parseCatalogueSpheroid(value: unknown, at: string): CatalogueSpheroid {
  const sph = value as Record<string, unknown> | null | undefined;
  if (!sph || typeof sph.source !== 'string' || !sph.source || typeof sph.basis !== 'string' || !sph.basis) throw new TypeError(`${at} needs its fit's numbers, a source and a basis; got ${JSON.stringify(sph)}.`);
  const num = (key: keyof CatalogueSpheroid) => { const number = sph[key]; if (typeof number !== 'number' || !Number.isFinite(number)) throw new TypeError(`${at}.${key} must be a finite number, got ${JSON.stringify(number)}.`); return number; };
  return { centerRaDeg: num('centerRaDeg'), centerDecDeg: num('centerDecDeg'), distancePc: num('distancePc'), halfLightRadiusKpc: num('halfLightRadiusKpc'),
    sersicIndex: num('sersicIndex'), axisRatio: num('axisRatio'), axisPositionAngleDeg: num('axisPositionAngleDeg'), cutoffHalfLightRadii: num('cutoffHalfLightRadii') };
}

/**
 * A spheroid placement: the deprojected Sérsic density (Prugniel & Simien 1997) of a published fit, on an oblate spheroid
 * whose axis lies in the plane of the sky at a position angle, ending at `cutoffHalfLightRadii`. Each ICRS row
 * (`[raDeg, decDeg]`) sits along its sight line at a depth drawn from that density, seeded by the bank's id and the row's
 * order, so a bake repeats it exactly: one of 400 steps through the spheroid by the density. A row whose sight line misses
 * the spheroid stays at the spheroid's distance. The depth is drawn, not measured.
 *
 * Without `aroundOriginM` the points are Sun-centred ICRS Cartesian in kpc, rounded to 0.1 pc, each at its step's middle.
 * With it (an object's world origin, in metres) they are offsets from the spheroid's centre in pc, rounded to 1e-4 pc,
 * each also at a drawn place within its step: the app's view of such a bank comes close enough for the steps to show as
 * sheets. The origin must be the spheroid's centre to one part in a million of its distance, the proper motion between
 * a catalogue position and a frame's epoch; `at` names the recipe field a refusal reports.
 */
export function placeSpheroidRows({ sky, spheroid, id, aroundOriginM, at }: { sky: readonly (readonly [number, number])[]; spheroid: CatalogueSpheroid; id: string;
  aroundOriginM?: readonly number[]; at: string }): { points: number[][]; maxDistanceKpc: number } {
  const { centerRaDeg, centerDecDeg, distancePc, halfLightRadiusKpc: re, sersicIndex: n, axisRatio: q, axisPositionAngleDeg: pa, cutoffHalfLightRadii: cutoff } = spheroid;
  const rad = Math.PI / 180, unit = (raDeg: number, decDeg: number) => [Math.cos(decDeg * rad) * Math.cos(raDeg * rad), Math.cos(decDeg * rad) * Math.sin(raDeg * rad), Math.sin(decDeg * rad)];
  const target = unit(centerRaDeg, centerDecDeg), northPole = [0, 0, 1], dotv = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const northRaw = northPole.map((v, i) => v - dotv(northPole, target) * target[i]!), northLength = Math.hypot(...northRaw), north = northRaw.map(v => v / northLength);
  const east = [north[1]! * target[2]! - north[2]! * target[1]!, north[2]! * target[0]! - north[0]! * target[2]!, north[0]! * target[1]! - north[1]! * target[0]!];
  const axis = [0, 1, 2].map(i => Math.sin(pa * rad) * east[i]! + Math.cos(pa * rad) * north[i]!), dKpc = distancePc / 1000;
  const p = 1 - 0.6097 / n + 0.05463 / (n * n), b = 1.9992 * n - 0.3271;
  const density = (point: number[]) => {
    const offset = point.map((v, i) => v - target[i]! * dKpc), axial = dotv(offset, axis), radial = Math.sqrt(Math.max(0, dotv(offset, offset) - axial * axial));
    const m = Math.hypot(radial, axial / q) / re;
    return m >= cutoff ? 0 : Math.max(m, .01) ** -p * Math.exp(-b * (Math.max(m, .01) ** (1 / n) - 1));
  };
  if (aroundOriginM) {
    const apartPc = Math.hypot(...aroundOriginM.map((value, index) => value / PC_M - target[index]! * distancePc));
    if (!(apartPc <= distancePc * 1e-6)) throw new RangeError(`${at} is centred ${apartPc.toFixed(4)} pc from the origin its bank is written around; they must lie within ${(distancePc * 1e-6).toFixed(4)} pc.`);
  }
  const draw = (index: number, salt: string) => (Number(createHash('sha256').update(`${id}:${index}${salt}`).digest().readBigUInt64BE(0) >> 11n) + 0.5) / 2 ** 53;
  const reach = cutoff * re;
  let maxDistanceKpc = 0;
  const points = sky.map(([ra, dec], index) => {
    const ray = unit(ra, dec), weights: number[] = [];
    for (let k = 0; k < DEPTH_STEPS; k++) { const t = dKpc - reach + (k + 0.5) / DEPTH_STEPS * 2 * reach; weights.push(density(ray.map(v => v * t))); }
    const total = weights.reduce((a, c) => a + c, 0);
    let distance = dKpc;
    if (total > 0) {
      const want = draw(index, ':depth') * total; let k = 0, running = weights[0]!;
      while (running < want && k < DEPTH_STEPS - 1) running += weights[++k]!;
      distance = dKpc - reach + (k + (aroundOriginM ? draw(index, ':step') : 0.5)) / DEPTH_STEPS * 2 * reach;
    }
    maxDistanceKpc = Math.max(maxDistanceKpc, distance);
    if (aroundOriginM) return ray.map((value, i) => Math.round((value * distance - target[i]! * dKpc) * 1e7) / 1e4);
    return ray.map(value => Math.round(value * distance * 1e4) / 1e4);
  });
  return { points, maxDistanceKpc };
}
