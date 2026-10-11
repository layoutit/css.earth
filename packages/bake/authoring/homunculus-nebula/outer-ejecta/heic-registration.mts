/**
 * heic1912a (ESA/Hubble's [N II] composite of Eta Carinae) on the sky: its scale and the star's pixel, fitted against the
 * Gaia-aligned 2014.59 F658N epoch on the grid (the original study's register_heic.py). Both are north up.
 *
 * Compared between 3 and 14 arcsec of the star on every second grid pixel of a 30-arcsec square: the epoch's log
 * brightness (after a Gaussian blur of 2 pixels, at least 1e-3) against heic1912a's red channel (blurred by 2 of its
 * pixels, at least 1e-3, read bilinearly where the place falls in the picture). The correlation is maximized by
 * Nelder-Mead from three scales (0.0222, 0.0226, 0.023 arcsec a pixel) and the star 15 pixels right of and 58 below the
 * picture's middle; the best of the three is kept. Result: [arcsec per picture pixel, star column, star row].
 */
import sharp from 'sharp';
import { gaussianFilter, mapCoordinates } from './ndimage.mts';
import { nelderMead } from './nelder-mead.mts';
import { mean, pairwiseSum } from './numpy-statistics.mts';
import { HALF, PIX, SIDE } from './sky-grid.mts';
import type { GridImage } from './hubble-epochs.mts';

/** A picture as PIL's `convert('RGB')` gives it: 8-bit channels (any alpha dropped), divided by 255. */
export async function readPicture(path: string): Promise<{ rgb: Float64Array; width: number; height: number }> {
  const { data, info } = await sharp(path, { limitInputPixels: false }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new TypeError(`${path}: expected three channels after dropping alpha, got ${info.channels}.`);
  return { rgb: Float64Array.from(data, value => value / 255), width: info.width, height: info.height };
}
/** One channel of a picture. */
export const channelOf = (picture: { rgb: Float64Array; width: number; height: number }, c: 0 | 1 | 2) => Float64Array.from({ length: picture.width * picture.height }, (_, p) => picture.rgb[3 * p + c]!);

/** The registration: [arcsec per pixel, star column, star row] and its correlation. */
export function registerHeic(picture: { rgb: Float64Array; width: number; height: number }, epoch2014: GridImage, log = console.log): { x: [number, number, number]; correlation: number } {
  const { width: W, height: H } = picture, red = gaussianFilter(channelOf(picture, 0), [H, W], 2);
  const smooth = gaussianFilter(epoch2014.map(value => Number.isFinite(value) ? value : 0), [SIDE, SIDE], 2);
  // numpy.mgrid[-300:300:2, -300:300:2]: rows ys, columns xs.
  const E: number[] = [], N: number[] = [], R: number[] = [];
  for (let ys = -300; ys < 300; ys += 2) for (let xs = -300; xs < 300; xs += 2) {
    const e = -xs * PIX, n = ys * PIX, rr = Math.hypot(e, n); if (!(rr > 3 && rr < 14)) continue;
    E.push(e); N.push(n); R.push(Math.fround(Math.log10(Math.max(smooth[(HALF + ys) * SIDE + HALF + xs]!, Math.fround(1e-3)))));
  }
  const rows = new Float64Array(E.length), cols = new Float64Array(E.length);
  const corr = (p: Float64Array) => {
    const [s, x0, y0] = p as unknown as [number, number, number];
    for (let i = 0; i < E.length; i++) { cols[i] = x0 - E[i]! / s; rows[i] = y0 - N[i]! / s; }
    const M = mapCoordinates(red, [H, W], rows, cols, { order: 1, mode: 'constant', cval: NaN }), a: number[] = [], b: number[] = [];
    for (let i = 0; i < E.length; i++) if (Number.isFinite(M[i]!)) { a.push(R[i]!); b.push(Math.log10(Math.max(M[i]!, 1e-3))); }
    const a32 = Float32Array.from(a), am = mean(a32, { float32: true }), ad = a32.map(value => value - am), bm = mean(Float64Array.from(b)), bd = Float64Array.from(b, value => value - bm);
    const ab = pairwiseSum(Float64Array.from(ad, (value, i) => value * bd[i]!)), aa = pairwiseSum(ad.map(value => value * value), { float32: true }), bb = pairwiseSum(bd.map(value => value * value));
    return -ab / Math.sqrt(aa * bb);
  };
  let best: { x: Float64Array; fun: number } | undefined;
  for (const s0 of [0.0222, 0.0226, 0.023]) { const result = nelderMead(corr, [s0, W / 2 + 15, H / 2 + 58], { xatol: 0.05, fatol: 1e-5, maxiter: 600 }); if (!best || result.fun < best.fun) best = result; }
  const x = Array.from(best!.x) as [number, number, number];
  log(`heic1912a: scale ${x[0].toFixed(5)} arcsec/px, star at (${x[1].toFixed(1)}, ${x[2].toFixed(1)}), correlation ${(-best!.fun).toFixed(3)}`);
  return { x, correlation: -best!.fun };
}
