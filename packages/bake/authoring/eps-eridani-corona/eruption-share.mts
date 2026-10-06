/** How much of the drawn corona each released simulation run's eruption disturbs.
 *
 * Ó Fionnagáin et al. (2022) released each magnetic map's simulation ten minutes after an eruption set off at one of three
 * places, not the steady state the eruptions start from. The three runs of a map share that steady state and each
 * eruption disturbs a different region, so the median of the three at a point is the steady state wherever at most one
 * eruption reaches. A run is disturbed at a voxel where its density is more than `factor` from that median, either way.
 * The share of such voxels is the size of its eruption, and their mean latitude says where it was set off. */
import { NATIVE } from './simulation.mts';

const median3 = (a: number, b: number, c: number) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

export function eruptionShares(densities: readonly [Float32Array, Float32Array, Float32Array], factor = 1.25) {
  const { size, halfUnits } = NATIVE, step = 2 * halfUnits / size;
  const disturbed = [0, 0, 0], latitudeSum = [0, 0, 0];
  let inside = 0, twoDisturbed = 0;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const z = -halfUnits + (k + 0.5) * step, radius = Math.hypot(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step, z);
    if (radius < 1 || radius > halfUnits) continue;
    const o = (k * size + j) * size + i, values = [densities[0][o]!, densities[1][o]!, densities[2][o]!] as const;
    if (!values.every(Number.isFinite)) continue;
    inside++;
    const middle = median3(...values);
    let off = 0;
    for (const [run, value] of values.entries()) if (value > middle * factor || value < middle / factor) { disturbed[run]!++; latitudeSum[run]! += Math.asin(z / radius) * 180 / Math.PI; off++; }
    if (off >= 2) twoDisturbed++;
  }
  return { factor, share: disturbed.map(count => count / inside), meanLatitudeDegrees: disturbed.map((count, run) => count ? latitudeSum[run]! / count : NaN),
    /** Where two runs depart at once the median is not the steady state; this is that share of the volume. */
    twoRunsShare: twoDisturbed / inside };
}
