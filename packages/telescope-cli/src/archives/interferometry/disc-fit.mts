/** The uniform disc that best fits a star's squared visibilities, and the image a reconstruction starts from.
 *
 * The diameter is scanned on a fine grid around a reference size the caller states (a measured diameter), because past the first
 * null of the visibility function a star that is not a disc fits several sizes almost equally badly; the best grid value is then
 * refined. Each squared-visibility error is floored at 1e-4, as the π¹ Gruis package's recorded fit does: without it the points
 * past the null, whose squared visibilities and errors are both tiny, decide the fit and it lands in the wrong lobe (27.3 mas with
 * reduced chi-squared 1,002 there, against 18.17 mas). The resolution of the data is half the mean wavelength over the longest
 * baseline, the beam the spot maps are convolved with. */
import type { ChannelRows } from '@cssearth/bake/objects/layers/observation';
import { writeReconstruction } from '@cssearth/bake/objects/layers/observation';
import { limbDarkenedVisibility } from './spotless-disc.mts';
import { limbDarkenedDiscVisibility } from './alma-disc-selfcal.mts';

const MAS_PER_RADIAN = 206_264_806.247;

export function fitUniformDisc(rows: Pick<ChannelRows, 'vis2' | 'wavelengthsMetres'>, { referenceMas, stepMas = 0.01, minimumError = 1e-4 }: { referenceMas: number; stepMas?: number; minimumError?: number }) {
  const minimumMas = referenceMas * 0.5, maximumMas = referenceMas * 1.5;
  const points = rows.vis2.filter(row => Number.isFinite(row.vis2) && row.error > 0).map(row => ({ baseline: Math.hypot(row.u, row.v), wavelength: row.wavelengthMetres, value: row.vis2, error: Math.max(row.error, minimumError) }));
  if (points.length < 3) throw new Error('A disc fit needs at least three squared visibilities.');
  const chi2 = (diameter: number) => points.reduce((sum, point) => sum + ((limbDarkenedVisibility(point.baseline, point.wavelength, diameter, 0) ** 2 - point.value) / point.error) ** 2, 0);
  let best = { diameter: minimumMas, chi2: Infinity };
  for (let diameter = minimumMas; diameter <= maximumMas + 1e-9; diameter += stepMas) { const value = chi2(diameter); if (value < best.chi2) best = { diameter, chi2: value }; }
  // Golden-section refinement inside the best grid step.
  let low = best.diameter - stepMas, high = best.diameter + stepMas;
  for (let i = 0; i < 40; i++) { const a = high - (high - low) / 1.618034, b = low + (high - low) / 1.618034; if (chi2(a) < chi2(b)) high = b; else low = a; }
  const diameterMas = (low + high) / 2, longest = Math.max(...points.map(point => point.baseline));
  const meanWavelength = points.reduce((sum, point) => sum + point.wavelength, 0) / points.length;
  return { diameterMas, reducedChi2: chi2(diameterMas) / points.length, points: points.length, longestBaselineMetres: longest, beamMas: meanWavelength / (2 * longest) * MAS_PER_RADIAN };
}

/** The power-law limb-darkened disc, I(mu) = mu^alpha (Hestroffer 1997), that best fits the squared visibilities inside the first
 * lobe: the baselines shorter than the first null of the uniform disc of `uniformMas`. There the whole disc dominates; past the
 * null a spotted star's cells do, and a smooth law fitted to them measures the cells, not the limb (π¹ Gruis: alpha 1.29 in the
 * first lobe, 0.42 over every baseline). Errors are floored as the uniform-disc fit floors them. `alphaRange` is where the
 * chi-squared, with the diameter refitted, stays within one reduced chi-squared of the minimum: the one-sigma interval once the
 * errors are scaled so the best fit has reduced chi-squared 1. */
export function fitPowerLawDisc(rows: Pick<ChannelRows, 'vis2' | 'wavelengthsMetres'>, { uniformMas, minimumError = 1e-4, maximumAlpha = 3 }: { uniformMas: number; minimumError?: number; maximumAlpha?: number }) {
  const firstNull = 3.8317 / (Math.PI * uniformMas / MAS_PER_RADIAN);
  const points = rows.vis2.filter(row => Number.isFinite(row.vis2) && row.error > 0).map(row => ({ q: Math.hypot(row.u, row.v) / row.wavelengthMetres, value: row.vis2, error: Math.max(row.error, minimumError) }))
    .filter(point => point.q < firstNull);
  if (points.length < 4) throw new Error(`A limb fit needs at least four squared visibilities inside the first lobe; ${points.length} are.`);
  const chi2 = (diameterMas: number, alpha: number) => points.reduce((sum, point) => sum + ((limbDarkenedDiscVisibility(point.q, diameterMas / MAS_PER_RADIAN, alpha, 100) ** 2 - point.value) / point.error) ** 2, 0);
  const bestDiameter = (alpha: number, low: number, high: number) => {
    for (let i = 0; i < 30; i++) { const a = high - (high - low) / 1.618034, b = low + (high - low) / 1.618034; if (chi2(a, alpha) < chi2(b, alpha)) high = b; else low = a; }
    const diameterMas = (low + high) / 2; return { diameterMas, chi2: chi2(diameterMas, alpha) };
  };
  let best = { diameterMas: uniformMas, alpha: 0, chi2: Infinity };
  for (let alpha = 0; alpha <= maximumAlpha + 1e-9; alpha += 0.1) { const fit = bestDiameter(alpha, uniformMas * 0.9, uniformMas * 1.4); if (fit.chi2 < best.chi2) best = { ...fit, alpha }; }
  for (let alpha = Math.max(0, best.alpha - 0.1); alpha <= Math.min(maximumAlpha, best.alpha + 0.1) + 1e-9; alpha += 0.01) { const fit = bestDiameter(alpha, best.diameterMas - 1, best.diameterMas + 1); if (fit.chi2 < best.chi2) best = { ...fit, alpha }; }
  const reduced = best.chi2 / (points.length - 2), inside: number[] = [];
  for (let alpha = Math.max(0, best.alpha - 0.5); alpha <= Math.min(maximumAlpha, best.alpha + 0.5) + 1e-9; alpha += 0.01) {
    if (bestDiameter(alpha, best.diameterMas - 1.5, best.diameterMas + 1.5).chi2 <= best.chi2 + reduced) inside.push(alpha);
  }
  return { diameterMas: best.diameterMas, alpha: best.alpha, alphaRange: [Math.min(...inside), Math.max(...inside)] as const, reducedChi2: reduced, points: points.length };
}

/** A flux-normalised uniform disc centred on a square grid, east to the left (negative CDELT1), with the RA and Dec axis cards
 * SQUEEZE writes on its own images. */
export function discStartImage(diameterMas: number, pixelMas: number, width: number) {
  const values = new Float64Array(width * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    if (Math.hypot((x - width / 2 + 0.5) * pixelMas, (y - width / 2 + 0.5) * pixelMas) <= diameterMas / 2) values[y * width + x] = 1;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) throw new RangeError('The disc is smaller than one pixel.');
  values.forEach((value, index) => { values[index] = value / total; });
  const centre = width / 2 + 0.5;
  return writeReconstruction({ width, height: width, values, cards: [['CDELT1', -pixelMas, 'mas, east left'], ['CDELT2', pixelMas, 'mas, north up'], ['CRPIX1', centre], ['CRPIX2', centre], ['CRVAL1', 0], ['CRVAL2', 0], ['CTYPE1', 'RA'], ['CTYPE2', 'DEC']] }, values, []);
}
