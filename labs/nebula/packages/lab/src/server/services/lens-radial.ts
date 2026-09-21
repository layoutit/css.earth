/**
 * Does brightness fall off with radius the way the source does? A histogram (Levels) is spatially blind: it
 * can match p50/p90/p99 exactly while the structure sits in the wrong place. The difference map shows where
 * the error is but does not quantify its radial shape. This measures the azimuthally averaged source and
 * render brightness in radial bins from the footprint's own centroid, so a brightness swap between the centre
 * and an annulus - invisible to the histogram, since it only rearranges where the same values sit - shows up
 * as a per-bin ratio far from one.
 *
 * Reuses the same pinned grid, source/render pairs and material corrections `lens-levels.ts` and
 * `lens-difference.ts` read (`lensLevelPairs`, `loadLensLevelGrid`), so the three diagnostics can never
 * disagree about what "source" and "render" mean.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PreparedReconstruction } from '../../features/reconstruction/reconstruction-types.ts';
import { lensLevelPairs, loadLensLevelGrid, type LensLevelGrid, type LensLevelMaterial } from './lens-levels.ts';

/** Radial bins from the footprint centroid out to the farthest covered pixel. */
export const RADIAL_BINS = 24;
/** Rec. 709 luma weights, applied to the 8-bit channel levels (same weights the difference map uses). */
const LUMA = [.2126, .7152, .0722] as const;

export interface LensRadialBin {
  /** Bin centre radius, in grid pixels from the footprint centroid. */
  radius: number;
  pixels: number;
  /** Null when the bin holds no covered pixels. */
  sourceMean: number | null; renderMean: number | null;
  /** Null when the source side of the bin averages to (near) zero, so a ratio would be meaningless. */
  ratio: number | null;
  signedDelta: number | null;
}
export interface LensRadialWorstBin { radius: number; ratio: number; pixels: number }
export interface LensRadialProfile {
  schema: 'cssearth-nebula-lens-radial@1';
  resultId: string; imageId: string;
  grid: { width: number; height: number };
  bins: number;
  footprintPixels: number;
  /** The footprint's own geometric centroid, in grid pixel coordinates. Never brightness-weighted. */
  centroid: { x: number; y: number };
  maxRadius: number; binWidth: number;
  radialBins: LensRadialBin[];
  /** Radius enclosing half the total luminance, source and render separately; null with no positive flux. */
  halfLightRadiusSource: number | null; halfLightRadiusRender: number | null;
  /** Render half-light radius over source: 1 matched, below 1 render compressed toward the centre, above 1 expanded. */
  halfLightRadiusRatio: number | null;
  /** Pixel-count-weighted RMS of |log(ratio)|; ratios below machine epsilon use that finite floor. */
  rmsLogRatio: number | null;
  /** The bin whose ratio departs furthest from one. Null when no bin has a defined ratio. */
  worstBin: LensRadialWorstBin | null;
  note: string;
}

/** The whole measurement, over one prepared grid. Kept pure so its tests never need a bake. */
export function radialProfileStatistics(grid: LensLevelGrid, material: LensLevelMaterial = { channelGain: null, toneCurve: null },
  bins = RADIAL_BINS): Pick<LensRadialProfile, 'footprintPixels' | 'centroid' | 'maxRadius' | 'binWidth' | 'radialBins' |
    'halfLightRadiusSource' | 'halfLightRadiusRender' | 'halfLightRadiusRatio' | 'rmsLogRatio' | 'worstBin'> {
  if (!Number.isInteger(bins) || bins < 1) throw new TypeError('The radial profile needs at least one bin.');
  const { width } = grid;
  const pairs = lensLevelPairs(grid, material);
  const footprint = pairs.covered.length;
  if (!footprint) throw new TypeError('This lens image covers none of the model projection.');
  let sx = 0, sy = 0;
  for (const p of pairs.covered) { sx += p % width; sy += Math.floor(p / width); }
  const centroid = { x: sx / footprint, y: sy / footprint };
  const radii = new Float64Array(footprint), sourceLum = new Float64Array(footprint), renderLum = new Float64Array(footprint);
  let maxRadius = 0;
  pairs.covered.forEach((p, k) => {
    const x = p % width, y = Math.floor(p / width), r = Math.hypot(x - centroid.x, y - centroid.y);
    radii[k] = r; if (r > maxRadius) maxRadius = r;
    let source = 0, render = 0;
    for (let c = 0; c < 3; c++) { source += LUMA[c] * pairs.source[k * 3 + c]!; render += LUMA[c] * pairs.render[k * 3 + c]!; }
    sourceLum[k] = source; renderLum[k] = render;
  });
  const binWidth = maxRadius > 0 ? maxRadius / bins : 1;
  const sourceSum = new Float64Array(bins), renderSum = new Float64Array(bins), counts = new Int32Array(bins);
  for (let k = 0; k < footprint; k++) {
    const index = Math.min(bins - 1, Math.floor(radii[k]! / binWidth));
    sourceSum[index]! += sourceLum[k]!; renderSum[index]! += renderLum[k]!; counts[index]! += 1;
  }
  const radialBins: LensRadialBin[] = [];
  let worstBin: LensRadialWorstBin | null = null, worstDeviation = 0, weightedSquare = 0, weight = 0;
  for (let i = 0; i < bins; i++) {
    const pixels = counts[i]!, radius = (i + .5) * binWidth;
    if (!pixels) { radialBins.push({ radius, pixels: 0, sourceMean: null, renderMean: null, ratio: null, signedDelta: null }); continue; }
    const sourceMean = sourceSum[i]! / pixels, renderMean = renderSum[i]! / pixels, signedDelta = renderMean - sourceMean;
    const ratio = sourceMean > 1e-6 ? renderMean / sourceMean : null;
    radialBins.push({ radius, pixels, sourceMean, renderMean, ratio, signedDelta });
    if (ratio !== null) {
      // A completely missing bright bin is a maximal defect, not missing evidence. Keep JSON finite.
      const deviation = Math.abs(Math.log(Math.max(Number.EPSILON, ratio)));
      weightedSquare += deviation * deviation * pixels; weight += pixels;
      if (deviation > worstDeviation) { worstDeviation = deviation; worstBin = { radius, ratio, pixels }; }
    }
  }
  const halfLight = (sums: Float64Array) => {
    let total = 0; for (const value of sums) total += value;
    if (!(total > 0)) return null;
    let cumulative = 0;
    for (let i = 0; i < bins; i++) { cumulative += sums[i]!; if (cumulative >= total / 2) return (i + .5) * binWidth; }
    return maxRadius;
  };
  const halfLightRadiusSource = halfLight(sourceSum), halfLightRadiusRender = halfLight(renderSum);
  const halfLightRadiusRatio = halfLightRadiusSource !== null && halfLightRadiusRender !== null && halfLightRadiusSource > 0
    ? halfLightRadiusRender / halfLightRadiusSource : null;
  return { footprintPixels: footprint, centroid, maxRadius, binWidth, radialBins,
    halfLightRadiusSource, halfLightRadiusRender, halfLightRadiusRatio,
    rmsLogRatio: weight > 0 ? Math.sqrt(weightedSquare / weight) : null, worstBin };
}

/** Measure one saved finite lens, from the same pinned grid the levels and difference routes read. */
export async function lensRadialProfile(root: string, prepared: PreparedReconstruction, options: { bins?: number } = {}): Promise<LensRadialProfile> {
  const { grid, material } = await loadLensLevelGrid(root, prepared);
  const bins = options.bins ?? RADIAL_BINS;
  const statistics = radialProfileStatistics(grid, material, bins);
  return { schema: 'cssearth-nebula-lens-radial@1', resultId: prepared.resultId, imageId: prepared.imageId,
    grid: { width: grid.width, height: grid.height }, bins, ...statistics,
    note: 'Azimuthally averaged luminance in radial bins from the footprint’s own geometric centroid. Levels ' +
      'can match p50/p90/p99 while the structure sits in the wrong place; a per-bin ratio far from one, or a ' +
      'half-light radius ratio far from one, means the render’s radial shape differs even where its histogram does not. ' +
      'Log ratios use machine epsilon as a finite floor for a completely dark render bin.' };
}

/** GET `?resultId=<lens>` answers the radial profile JSON. Never writes. */
export function lensRadialHandler(root: string, read: (resultId: string) => Promise<PreparedReconstruction>) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      if (request.method !== 'GET') throw new TypeError('The radial profile is read-only.');
      const url = new URL(request.url ?? '/', 'http://localhost'), id = url.searchParams.get('resultId') ?? '';
      if (!/^[a-f0-9]{64}$/.test(id)) throw new TypeError('Invalid reconstruction identity.');
      const value = await lensRadialProfile(root, await read(id));
      response.setHeader('Cache-Control', 'no-store'); response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value));
    } catch (error) {
      response.statusCode = 400; response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  };
}
