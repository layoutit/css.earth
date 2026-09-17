/** The uniform disc that best fits a star's squared visibilities, and the image a reconstruction starts from.
 *
 * The diameter is scanned on a fine grid around a reference size the caller states (a measured diameter), because past the first
 * null of the visibility function a star that is not a disc fits several sizes almost equally badly; the best grid value is then
 * refined. Each squared-visibility error is floored at 1e-4, as the π¹ Gruis package's recorded fit does: without it the points
 * past the null, whose squared visibilities and errors are both tiny, decide the fit and it lands in the wrong lobe (27.3 mas with
 * reduced chi-squared 1,002 there, against 18.17 mas). The resolution of the data is half the mean wavelength over the longest
 * baseline, the beam the spot maps are convolved with. */
import type { ChannelRows } from './oifits-rows.mts';
import { writeReconstruction } from './beam-convolve.mts';
import { limbDarkenedVisibility } from './spotless-disc.mts';

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
