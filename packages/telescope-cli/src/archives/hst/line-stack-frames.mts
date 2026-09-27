/** The STIS line frames a stack is made from: their headers and read regions, where the body sits along and across the slit,
 * the sky level and the reflected sunlight each frame carries. */
import type { FitsHeader } from '@cssearth/fits';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { clippedMean, median, robustScatter, type LineStackDefinition } from './line-stack-reduction.mts';
import type { FrameEphemeris } from './line-stack-ephemeris.mts';

export const DEGREE = Math.PI / 180;
export const MJD_TO_JD = 2400000.5;
/** Characters 1-6 of a rootname are the HST visit. One pointing is measured per visit, because the telescope holds its
 * pointing well inside a pixel for the length of one. */
const VISIT_LENGTH = 6;
export type Card = readonly [string, string | number | boolean, string?];

// ---- frame headers ----------------------------------------------------------------------------------------------------
export interface FrameHeader {
  readonly name: string; readonly rootname: string; readonly visit: string; readonly programme: string; readonly targetName: string;
  readonly exposureSeconds: number; readonly startMjd: number; readonly endMjd: number;
  /** The commanded offset along the aperture's second axis, arcseconds. Rows grow along `+AXIS2`, so it moves the target by
   * `+POSTARG2/plate scale` rows from the reference pixel. */
  readonly postArg2Arcsec: number;
  readonly orientatDegrees: number; readonly crpix1: number; readonly crpix2: number; readonly crval1: number;
  /** Wavelength per column, Å (`CD1_1`), and arcseconds per row along the slit (`CD2_2`). */
  readonly dispersionAngstrom: number; readonly plateScaleArcsec: number;
  /** The product's own continuum-to-emission-line conversion for its slit, Å (`CONT2EML`). */
  readonly continuumToEmissionLineAngstrom: number;
  readonly width: number; readonly height: number; readonly hdu: FitsFileHdu;
}

const cardNumber = (header: FitsHeader, key: string, name: string) => {
  const value = header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} carries no numeric ${key}.`);
  return value;
};
const cardText = (header: FitsHeader, key: string, name: string) => {
  const value = header[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} carries no ${key}.`);
  return value.trim();
};

/** One rectified frame's headers. Only header blocks are read; the image itself is read a region at a time, later. */
export async function readFrameHeader(path: string, name: string): Promise<FrameHeader> {
  const hdus = await readFitsFileHdus(path), primary = hdus[0]?.header, science = hdus[1];
  if (!primary || !science || science.dimensions.length !== 2) throw new Error(`${name} is not a rectified two-axis product.`);
  const rootname = cardText(primary, 'ROOTNAME', name).toLowerCase();
  if (!name.startsWith(rootname)) throw new Error(`${name} carries rootname ${rootname}.`);
  return {
    name, rootname, visit: rootname.slice(0, VISIT_LENGTH), programme: String(cardNumber(primary, 'PROPOSID', name)), targetName: cardText(primary, 'TARGNAME', name),
    exposureSeconds: cardNumber(primary, 'TEXPTIME', name), startMjd: cardNumber(primary, 'TEXPSTRT', name), endMjd: cardNumber(primary, 'TEXPEND', name),
    postArg2Arcsec: cardNumber(primary, 'POSTARG2', name), orientatDegrees: cardNumber(science.header, 'ORIENTAT', name),
    crpix1: cardNumber(science.header, 'CRPIX1', name), crpix2: cardNumber(science.header, 'CRPIX2', name), crval1: cardNumber(science.header, 'CRVAL1', name),
    dispersionAngstrom: cardNumber(science.header, 'CD1_1', name), plateScaleArcsec: cardNumber(science.header, 'CD2_2', name) * 3600,
    continuumToEmissionLineAngstrom: cardNumber(science.header, 'CONT2EML', name),
    width: science.dimensions[0]!, height: science.dimensions[1]!, hdu: science,
  };
}

/** A frame with everything the stack needs about it: its headers, where the body was, and whether it is used. */
export interface PreparedFrame extends FrameHeader {
  readonly ephemeris: FrameEphemeris;
  /** The body's radius in detector rows, from its apparent size and the plate scale. */
  readonly radiusPixels: number;
  /** The row the pointing commands, before the continuum measurement moves it. */
  readonly commandedRow: number;
  readonly rejected: string;
}

/** The region of one frame the reduction reads: every column between two wavelengths, and every row. */
interface FrameRegion {
  readonly x0: number; readonly width: number; readonly height: number; readonly values: Float64Array;
  /** The region column a wavelength falls in, and the wavelength of a region column. */
  readonly columnAt: (angstrom: number) => number;
  readonly angstromAt: (column: number) => number;
}
export async function readFrameRegion(path: string, frame: FrameHeader, window: readonly [number, number]): Promise<FrameRegion> {
  const detectorColumn = (angstrom: number) => frame.crpix1 - 1 + (angstrom - frame.crval1) / frame.dispersionAngstrom;
  const x0 = Math.round(detectorColumn(window[0])), x1 = Math.round(detectorColumn(window[1]));
  // The whole window has to be on the detector. A window the frame only partly holds would be read short, and every later
  // step — the row search, the sky, the continuum fit — would run on fewer columns than it asked for without saying so.
  if (x0 < 0 || x1 > frame.width - 1 || x1 <= x0) throw new Error(`${frame.name} does not hold ${window[0]}-${window[1]} Å.`);
  const region = await readFitsFileRegion(path, frame.hdu, { x0, y0: 0, width: x1 - x0 + 1, height: frame.height });
  return { x0, width: region.width, height: frame.height, values: region.values,
    columnAt: angstrom => Math.round(detectorColumn(angstrom)) - x0, angstromAt: column => frame.crval1 + (column + x0 - (frame.crpix1 - 1)) * frame.dispersionAngstrom };
}

// ---- registration -----------------------------------------------------------------------------------------------------
export interface VisitRegistration {
  readonly visit: string; readonly frames: number; readonly unlit: boolean;
  /** How far the body sits from the row the pointing commands, in rows, and from how many frames that was measured. */
  rowOffsetPixels: number; readonly rowDetections: number;
  /** How far the body sits from the middle of the slit, in columns, and the signal-to-noise of the fit that gave it. */
  readonly acrossSlitOffsetPixels: number; readonly acrossSlitSnr: number; readonly acrossSlitFitted: boolean;
  note: string;
}

/** Where the body sits along the slit in one frame, measured from the sunlight it reflects.
 *
 * The reflected continuum is the body itself: summed over a window with no emission line in it, it makes a top hat as wide as
 * the body on an otherwise empty slit. The search is a matched filter of that width, over a few tens of rows either side of
 * the commanded row, and a detection has to stand well above the scatter of the rows the body is not on. */
export function locateDiscRow(region: FrameRegion, frame: { readonly commandedRow: number; readonly radiusPixels: number }, reduction: LineStackDefinition['reduction']):
{ offsetPixels: number; contrast: number; detected: boolean } {
  const from = region.columnAt(reduction.continuumRowWindowAngstrom[0]), to = region.columnAt(reduction.continuumRowWindowAngstrom[1]);
  const profile = new Float64Array(region.height);
  for (let y = 0; y < region.height; y++) {
    let sum = 0;
    for (let x = from; x <= to; x++) { const value = region.values[y * region.width + x]!; if (Number.isFinite(value)) sum += value; }
    profile[y] = sum / (to - from + 1);
  }
  const away: number[] = [];
  for (let y = 0; y < region.height; y++) if (profile[y] !== 0 && Math.abs(y - frame.commandedRow) > 4 * frame.radiusPixels) away.push(profile[y]!);
  const level = median(away), scatter = robustScatter(away), width = Math.max(3, Math.round(2 * frame.radiusPixels));
  let best = -Infinity, bestRow = frame.commandedRow;
  for (let y = Math.round(frame.commandedRow - reduction.rowSearchPixels - width / 2); y <= Math.round(frame.commandedRow + reduction.rowSearchPixels - width / 2); y++) {
    if (y < 0 || y + width > region.height) continue;
    let sum = 0;
    for (let k = y; k < y + width; k++) sum += profile[k]! - level;
    if (sum > best) { best = sum; bestRow = y + width / 2 - 0.5; }
  }
  const contrast = best / width / (scatter || 1e-300);
  return { offsetPixels: bestRow - frame.commandedRow, contrast, detected: contrast > reduction.rowDetectionContrast && Number.isFinite(bestRow) };
}

/** Where the body sits across the slit, which only the reflected solar Lyman-α line constrains.
 *
 * The body's reflected Lyman-α is quasi-monochromatic, so at that wavelength the across-slit axis really is a picture of the
 * disc. The geocoronal Lyman-α that fills the whole slit is removed by differencing the rows on the body against rows a few
 * radii away; the column the slit itself is centred on is taken as the half-power centre of that slit-filling band, which
 * takes the wavelength zero point out of the answer. */
export function locateAcrossSlit(onDisc: Float64Array, offDisc: Float64Array, onRows: number, offRows: number, chordPixels: number):
{ offsetPixels: number; snr: number; slitCentrePixels: number } {
  const difference = Array.from(onDisc, (value, index) => value / Math.max(1, onRows) - offDisc[index]! / Math.max(1, offRows));
  const total = Array.from(onDisc, (value, index) => value / Math.max(1, onRows) + offDisc[index]! / Math.max(1, offRows));
  const peak = Math.max(...total);
  let first = 0, last = total.length - 1;
  for (let index = 0; index < total.length; index++) if (total[index]! >= peak / 2) { first = index; break; }
  for (let index = total.length - 1; index >= 0; index--) if (total[index]! >= peak / 2) { last = index; break; }
  const slitCentrePixels = (first + last) / 2;
  let best = -Infinity, bestCentre = slitCentrePixels;
  for (let index = 0; index + chordPixels <= difference.length; index++) {
    let sum = 0;
    for (let k = index; k < index + chordPixels; k++) sum += difference[k]!;
    if (sum > best) { best = sum; bestCentre = index + chordPixels / 2 - 0.5; }
  }
  const scatter = robustScatter(difference);
  return { offsetPixels: bestCentre - slitCentrePixels, snr: best / chordPixels / (scatter || 1e-300), slitCentrePixels };
}

// ---- one frame's reduction --------------------------------------------------------------------------------------------
/** The sky level of every column: a clipped mean over the rows a fixed distance above and below the body, which is the
 * window the published method uses. Empty rows — a rectified frame is mostly empty — take no part. */
export function skyByColumn(region: FrameRegion, discRow: number, reduction: LineStackDefinition['reduction']): Float64Array {
  const sky = new Float64Array(region.width);
  for (let x = 0; x < region.width; x++) {
    const sample: number[] = [];
    for (let y = 0; y < region.height; y++) {
      const distance = Math.abs(y - discRow);
      if (distance < reduction.skyRowsFromDisc[0] || distance > reduction.skyRowsFromDisc[1]) continue;
      const value = region.values[y * region.width + x]!;
      if (Number.isFinite(value) && value !== 0) sample.push(value);
    }
    sky[x] = clippedMean(sample, reduction.skyClipSigma);
  }
  return sky;
}

/** The reflected sunlight, modelled as one smooth amplitude per column times the body's own row profile.
 *
 * The body reflects a solar spectrum, so what it puts on the detector is the same shape along the slit at every wavelength,
 * scaled by how much sunlight that wavelength carries. The shape `disc` is measured from the frame itself over a window the
 * published albedos use; the amplitude is each column's projection onto it, and is fitted as a quadratic over the columns
 * near the line where no line falls, then read across the masked ones.
 *
 * This removes the reflected solar *continuum*. It does not remove a reflected solar *line*, which needs a measured solar
 * spectrum this route does not hold. */
export interface ReflectedSunlight { readonly profile: Float64Array; readonly firstRow: number; readonly lastRow: number; readonly amplitude: Float64Array }
export function reflectedSunlight(region: FrameRegion, sky: Float64Array, frame: { readonly radiusPixels: number }, discRow: number,
  reduction: LineStackDefinition['reduction'], masked: (column: number) => boolean): ReflectedSunlight {
  const firstRow = Math.max(0, Math.round(discRow - reduction.discProfileHalfHeightRadii * frame.radiusPixels));
  const lastRow = Math.min(region.height - 1, Math.round(discRow + reduction.discProfileHalfHeightRadii * frame.radiusPixels));
  const profile = new Float64Array(lastRow - firstRow + 1);
  for (let x = 0; x < region.width; x++) {
    if (masked(x)) continue;
    const angstrom = region.angstromAt(x);
    if (angstrom < reduction.discProfileWindowAngstrom[0] || angstrom > reduction.discProfileWindowAngstrom[1]) continue;
    for (let y = firstRow; y <= lastRow; y++) {
      const value = region.values[y * region.width + x]! - sky[x]!;
      if (Number.isFinite(value)) profile[y - firstRow]! += value;
    }
  }
  const peak = Math.max(...profile);
  for (let index = 0; index < profile.length; index++) profile[index] = peak > 0 ? profile[index]! / peak : 0;
  const norm = profile.reduce((total, value) => total + value * value, 0) || 1;
  const amplitude = new Float64Array(region.width);
  for (let x = 0; x < region.width; x++) {
    let sum = 0;
    for (let y = firstRow; y <= lastRow; y++) { const value = region.values[y * region.width + x]! - sky[x]!; if (Number.isFinite(value)) sum += value * profile[y - firstRow]!; }
    amplitude[x] = sum / norm;
  }
  return { profile, firstRow, lastRow, amplitude };
}

// ---- the run ----------------------------------------------------------------------------------------------------------
