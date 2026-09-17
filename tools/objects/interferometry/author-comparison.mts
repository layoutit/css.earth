/** Compare calibrated squared visibilities and reconstructed images with an author's published ones. */
import type { ChannelVis2 } from './oifits-rows.mts';
import { convolveGaussian, type BeamImage } from './beam-convolve.mts';

/** Pairs our calibrated squared visibilities with the author's for the same exposure: the nearest baseline vector (either sign)
 * within a metre with as many channels, matched in wavelength order. */
export function matchVis2(ours: readonly ChannelVis2[], theirs: readonly ChannelVis2[]) {
  const byBaseline = (rows: readonly ChannelVis2[]) => { const groups = new Map<string, ChannelVis2[]>(); for (const row of rows) { const key = `${row.u.toFixed(3)},${row.v.toFixed(3)}`; (groups.get(key) ?? groups.set(key, []).get(key)!).push(row); } return [...groups.values()].map(group => group.sort((a, b) => a.wavelengthMetres - b.wavelengthMetres)); };
  const reference = byBaseline(theirs), pairs: [ChannelVis2, ChannelVis2][] = [];
  for (const group of byBaseline(ours)) {
    const { u, v } = group[0]!;
    // The nearest baseline, not the first within a metre: a baseline moves less than a metre between neighbouring exposures.
    let match: ChannelVis2[] | undefined, nearest = 1;
    for (const candidate of reference) {
      if (candidate.length !== group.length) continue;
      const distance = Math.min(Math.hypot(candidate[0]!.u - u, candidate[0]!.v - v), Math.hypot(candidate[0]!.u + u, candidate[0]!.v + v));
      if (distance < nearest) { match = candidate; nearest = distance; }
    }
    if (match) group.forEach((row, index) => pairs.push([row, match[index]!]));
  }
  return pairs;
}

const quantile = (sorted: readonly number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;

/** The median, 5th and 95th percentile ratio of ours to theirs over the paired points, and the median difference in combined sigma. */
export function vis2Agreement(pairs: readonly (readonly [ChannelVis2, ChannelVis2])[]) {
  const ratios = pairs.map(([ours, theirs]) => ours.vis2 / theirs.vis2).filter(Number.isFinite).sort((a, b) => a - b);
  const sigmas = pairs.map(([ours, theirs]) => Math.abs(ours.vis2 - theirs.vis2) / Math.hypot(ours.error, theirs.error)).filter(Number.isFinite).sort((a, b) => a - b);
  return { pairs: pairs.length, medianRatio: quantile(ratios, 0.5), ratio5: quantile(ratios, 0.05), ratio95: quantile(ratios, 0.95), medianSigma: quantile(sigmas, 0.5) };
}

/** Correlation of two images of the same grid after both are convolved to the beam, over the pixels inside the disc. */
export function imageCorrelation(a: Pick<BeamImage, 'width' | 'height' | 'values'>, b: Pick<BeamImage, 'width' | 'height' | 'values'>, beamPixels: number, discRadiusPixels: number) {
  if (a.width !== b.width || a.height !== b.height) throw new TypeError('The images are on different grids.');
  const sa = convolveGaussian(a, beamPixels), sb = convolveGaussian(b, beamPixels), xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
    if (Math.hypot(x - a.width / 2 + 0.5, y - a.height / 2 + 0.5) > discRadiusPixels) continue;
    xs.push(sa[y * a.width + x]!); ys.push(sb[y * a.width + x]!);
  }
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length, mx = mean(xs), my = mean(ys);
  return xs.reduce((sum, value, i) => sum + (value - mx) * (ys[i]! - my), 0) / Math.sqrt(xs.reduce((sum, value) => sum + (value - mx) ** 2, 0) * ys.reduce((sum, value) => sum + (value - my) ** 2, 0));
}
