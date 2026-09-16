/** Image-plane evidence only. Scale/orientation never establish common depth. */
import { decomposeStructures, type WaveletSettings } from './wavelets.ts';

export const structureLayers = ['diffuse', 'arcs', 'knots', 'unassigned'] as const;
export type StructureLayer = typeof structureLayers[number];
export interface StructureMap {
  luminance: Float32Array;
  fractions: Record<StructureLayer, Float32Array>;
  directions: Float32Array;
  regions: ReturnType<typeof decomposeStructures>['catalog'];
  metrics: { reconstructionMaxError: number; unassignedFraction: number; regions: number;
    signalFractions: Record<StructureLayer, number> };
}

/** Eigenvalue ratio of the local Hessian distinguishes ridges from round peaks.
 * This is directional curvature analysis, not a curvelet or GETSF implementation.
 */
export function ridgeDirection(image: Float32Array, width: number, height: number, x: number, y: number) {
  const value = (xx: number, yy: number) => image[Math.max(0, Math.min(height - 1, yy)) * width + Math.max(0, Math.min(width - 1, xx))]!;
  const center = value(x, y), xx = value(x - 1, y) - 2 * center + value(x + 1, y);
  const yy = value(x, y - 1) - 2 * center + value(x, y + 1);
  const xy = (value(x + 1, y + 1) - value(x + 1, y - 1) - value(x - 1, y + 1) + value(x - 1, y - 1)) / 4;
  const gap = Math.hypot(xx - yy, 2 * xy), low = (xx + yy - gap) / 2, high = (xx + yy + gap) / 2;
  return { coherence: low < -1e-9 ? Math.max(0, 1 - Math.abs(high) / -low) : 0,
    tangentRadians: .5 * Math.atan2(2 * xy, xx - yy) };
}

export function analyzeStructureMap(rgb: Uint8Array, width: number, height: number, settings: WaveletSettings): StructureMap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 ||
      width * height > 1_000_000 || rgb.length !== width * height * 3) throw new TypeError('Bounded full RGB raster required.');
  const pixels = width * height;
  const luminance = Float32Array.from({ length: pixels }, (_, p) =>
    (.2126 * rgb[p * 3]! + .7152 * rgb[p * 3 + 1]! + .0722 * rgb[p * 3 + 2]!) / 255);
  const wavelets = decomposeStructures(luminance, width, height, settings);
  const diffuse = wavelets.coarse.slice(), arcs = new Float32Array(pixels), knots = new Float32Array(pixels);
  const directions = new Float32Array(pixels), strongestRidge = new Float32Array(pixels);
  const blurred = luminance.slice();
  for (let scale = 0; scale < wavelets.waveletPlanes.length; scale++) {
    const plane = wavelets.waveletPlanes[scale]!, threshold = wavelets.diagnostics.thresholdByScale[scale]!;
    for (let p = 0; p < pixels; p++) blurred[p]! -= plane[p]!;
    for (let p = 0; p < pixels; p++) {
      // Soft significance avoids painting the threshold as a hard contour.
      const detail = Math.max(0, plane[p]! - threshold);
      if (detail === 0) continue;
      const ridge = ridgeDirection(blurred, width, height, p % width, Math.floor(p / width));
      const arc = detail * ridge.coherence ** 2;
      arcs[p]! += arc;
      if (arc > strongestRidge[p]!) { strongestRidge[p] = arc; directions[p] = ridge.tangentRadians; }
      if (scale <= settings.compactMaxScale) knots[p]! += detail - arc;
      else diffuse[p]! += detail - arc;
    }
  }
  const fractions: StructureMap['fractions'] = { diffuse: new Float32Array(pixels), arcs: new Float32Array(pixels),
    knots: new Float32Array(pixels), unassigned: new Float32Array(pixels) };
  const signalFractions = { diffuse: 0, arcs: 0, knots: 0, unassigned: 0 };
  let total = 0, reconstructionMaxError = 0;
  for (let p = 0; p < pixels; p++) {
    const signal = luminance[p]!, evidence = diffuse[p]! + arcs[p]! + knots[p]!;
    // Conservative positive allocation; preserve the remainder, including faint
    // material below the detector threshold. No sky cut or geometric mask.
    const divisor = Math.max(signal, evidence, 1e-30);
    fractions.diffuse[p] = Math.max(0, diffuse[p]!) / divisor;
    fractions.arcs[p] = arcs[p]! / divisor;
    fractions.knots[p] = knots[p]! / divisor;
    const sum = fractions.diffuse[p]! + fractions.arcs[p]! + fractions.knots[p]!;
    // At black pixels the coarse image may be nonzero: no light is invented.
    if (signal === 0) for (const layer of structureLayers) fractions[layer][p] = 0;
    else {
      if (sum > 1) for (const layer of ['diffuse', 'arcs', 'knots'] as const) fractions[layer][p]! /= sum;
      fractions.unassigned[p] = Math.max(0, 1 - fractions.diffuse[p]! - fractions.arcs[p]! - fractions.knots[p]!);
    }
    let assignedFraction = 0;
    for (const layer of structureLayers) { signalFractions[layer] += signal * fractions[layer][p]!; assignedFraction += fractions[layer][p]!; }
    for (let c = 0; c < 3; c++) reconstructionMaxError = Math.max(reconstructionMaxError,
      Math.abs(rgb[p * 3 + c]! / 255 * (1 - assignedFraction)));
    total += signal;
  }
  for (const layer of structureLayers) signalFractions[layer] /= Math.max(total, 1e-30);
  return { luminance, fractions, directions, regions: wavelets.catalog,
    metrics: { reconstructionMaxError, unassignedFraction: signalFractions.unassigned, regions: wavelets.catalog.length, signalFractions } };
}

/** No gain or normalization: component RGB floats sum back to the input RGB. */
export function colorStructureLayer(rgb: Uint8Array, fractions: Float32Array): Float32Array {
  if (rgb.length !== fractions.length * 3) throw new TypeError('Color/support dimensions differ.');
  return Float32Array.from({ length: rgb.length }, (_, i) => rgb[i]! / 255 * fractions[Math.floor(i / 3)]!);
}
