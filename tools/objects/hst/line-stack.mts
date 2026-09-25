#!/usr/bin/env node
/** Stack STIS long-slit line images of a moving Solar System target in the target's own frame.
 *
 *   node tools/objects/hst/line-stack.mts <stack id> <frames directory> <output directory> [--fetch] [--receipt] [--mirror]
 *
 * A G140L exposure through the 52X2 slit holds a picture of a small body at every emission line: along the slit the body is
 * resolved, and at a line narrow enough the across-slit axis is a picture too. This stage takes every such exposure a
 * programme holds, finds the body in each one, removes the sky and the sunlight it reflects, turns the rest into Rayleigh
 * with the product's own slit conversion, and adds them up on a grid fixed to the body — north up, east left, measured in
 * body radii — weighted by exposure.
 *
 * Nothing about one body is written here. Which frames, which lines, which wavelengths are masked, which windows, which grid,
 * which frames are thrown away and which subsets are written all come from a pinned stack definition in `programs/`, beside
 * the raw JPL Horizons responses that place the body. The first one proven is Europa's oxygen aurora,
 * `programs/europa-oxygen-aurora.stack.json`; [docs/hubble.md](../../../docs/hubble.md) says what it measured and what it
 * does not.
 *
 * The arithmetic is in [line-stack-reduction.mts](line-stack-reduction.mts) and the geometry in
 * [line-stack-ephemeris.mts](line-stack-ephemeris.mts); both are pure and tested. This module is the part that reads files,
 * asks Horizons and writes products. Frames are streamed one at a time — a rectified G140L frame is 11 MB of floats and a
 * programme holds a hundred and more, so none is held after it has been used.
 *
 * What it writes to the output directory: `<line>-<subset>.fits`, whose `SCI` extension is the exposure-weighted mean surface
 * brightness in Rayleigh and whose `ERR` extension is its standard error, with the scale, orientation, handedness, frame
 * count and exposure stated in cards; `registration.json`, which says how every visit was placed; and, with `--receipt`, the
 * reproduction receipt beside the definition.
 *
 * Beside every stacked product it also writes that product's own record (`<product>.product.json`,
 * tools/objects/product-record.mts): the frames that went into that set at their pinned digests, the definition and Horizons
 * responses that placed them, and the settings of the line and subset. With `--receipt` the receipt's two checks are added to
 * those records as what they are: agreement with a published value, and the consistency of our own two handednesses. */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FitsHeader } from '@cssearth/fits';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { headerBlock, padBlock } from '../interferometry/fits-table.mts';
import { sha256 } from '@cssearth/core/node';
import { addProductEvidence, fileSize, productRecordPath, writeProductRecord, type ProductEvidence, type ProductInput, type ProductRun, type ProductSoftware } from '../product-record.mts';
import { PROGRAMS } from './archive.mts';
import {
  accumulatedImage, addSample, clippedMean, discMetrics, gridPoint, inSubset, limbFallOff, median, newAccumulator, parseLineStack,
  radialProfile, rayleighPerSample, rejectionReason, robustScatter, quadraticFit, sampleFor,
  type Handedness, type LineStackDefinition, type StackAccumulator, type StackLine,
} from './line-stack-reduction.mts';
import { readHorizonsResponses, stackEphemerides, writeHorizonsResponses, type FrameEphemeris } from './line-stack-ephemeris.mts';

const DEGREE = Math.PI / 180;
const MJD_TO_JD = 2400000.5;
/** Characters 1-6 of a rootname are the HST visit. One pointing is measured per visit, because the telescope holds its
 * pointing well inside a pixel for the length of one. */
const VISIT_LENGTH = 6;
type Card = readonly [string, string | number | boolean, string?];

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
async function readFrameRegion(path: string, frame: FrameHeader, window: readonly [number, number]): Promise<FrameRegion> {
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
export interface StackSet { readonly line: StackLine; readonly subset: string; readonly accumulator: StackAccumulator }
export interface LineStackRun {
  readonly definition: LineStackDefinition;
  readonly handedness: Handedness;
  readonly frames: readonly PreparedFrame[];
  readonly used: readonly PreparedFrame[];
  readonly registration: readonly VisitRegistration[];
  readonly sets: readonly StackSet[];
}

/** Every pinned frame, with its headers checked against the pin and its geometry from Horizons. */
export async function prepareFrames(definition: LineStackDefinition, directory: string, mayAsk: boolean, verifyDigests: boolean): Promise<PreparedFrame[]> {
  const headers: FrameHeader[] = [];
  for (const pinned of definition.frames) {
    const path = resolve(directory, pinned.name), header = await readFrameHeader(path, pinned.name);
    if (header.programme !== pinned.programme || header.targetName !== pinned.targetName)
      throw new Error(`${pinned.name}: the file is programme ${header.programme} target ${header.targetName}, the pin says ${pinned.programme} ${pinned.targetName}.`);
    if (verifyDigests) {
      if ((await stat(path)).size !== pinned.bytes) throw new Error(`${pinned.name}: the file on disk is not the recorded size.`);
    }
    headers.push(header);
  }
  const responsesPath = resolve(PROGRAMS, definition.horizons.responses), responses = await readHorizonsResponses(responsesPath);
  const before = Object.keys(responses).length;
  const ephemerides = await stackEphemerides(definition.horizons, responses, headers.map(header => (header.startMjd + header.endMjd) / 2 + MJD_TO_JD), mayAsk);
  if (Object.keys(responses).length !== before) await writeHorizonsResponses(responsesPath, responses);
  return headers.map((header, index) => {
    const ephemeris = ephemerides[index]!, pinned = definition.frames[index]!;
    const rejected = rejectionReason({ targetName: header.targetName, primaryLimbClearanceArcsec: ephemeris.primaryLimbClearanceArcsec }, definition.rejection);
    if (rejected !== (pinned.rejected ?? '')) throw new Error(`${pinned.name}: the pin says "${pinned.rejected ?? 'used'}", this run says "${rejected || 'used'}".`);
    const radiusPixels = ephemeris.angularDiameterArcsec / 2 / header.plateScaleArcsec;
    return { ...header, ephemeris, radiusPixels, commandedRow: header.crpix2 - 1 + header.postArg2Arcsec / header.plateScaleArcsec, rejected };
  });
}

/** Where the body's centre sits in a frame, once its visit's measured offset is applied. */
const discRow = (frame: PreparedFrame, registration: VisitRegistration) => frame.commandedRow + registration.rowOffsetPixels;

/** One position per visit: along the slit from the reflected continuum, across the slit from reflected Lyman-α.
 *
 * A visit whose target sees no sunlight — an eclipse — has neither, and takes the commanded pointing. So does a visit whose
 * fit is too weak or too far from the slit centre to believe. Both fallbacks are recorded in the note, because a placement
 * that was assumed is not a placement that was measured. */
export async function registerVisits(definition: LineStackDefinition, directory: string, frames: readonly PreparedFrame[]): Promise<VisitRegistration[]> {
  const reduction = definition.reduction, byVisit = new Map<string, PreparedFrame[]>();
  for (const frame of frames) (byVisit.get(frame.visit) ?? byVisit.set(frame.visit, []).get(frame.visit)!).push(frame);
  const unlitPattern = new RegExp(reduction.unlitTargetNamePattern, 'u');
  const registrations: VisitRegistration[] = [];
  for (const [visit, visitFrames] of byVisit) {
    const unlit = visitFrames.every(frame => unlitPattern.test(frame.targetName)), offsets: number[] = [];
    const half = Math.round(reduction.acrossSlitHalfWidthArcsec / visitFrames[0]!.plateScaleArcsec);
    const onDisc = new Float64Array(2 * half + 1), offDisc = new Float64Array(2 * half + 1);
    let onRows = 0, offRows = 0;
    for (const frame of visitFrames) {
      const region = await readFrameRegion(resolve(directory, frame.name), frame, reduction.readWindowAngstrom);
      const found = locateDiscRow(region, frame, reduction);
      if (found.detected) offsets.push(found.offsetPixels);
      // The body's row in this frame: its own measurement where the continuum was seen, and the last one this visit gave
      // otherwise, so that the across-slit sums are taken over the rows the body is actually on.
      const centre = frame.commandedRow + (offsets.at(-1) ?? 0);
      const lyman = region.columnAt(reduction.acrossSlitLineAngstrom);
      if (lyman - half < 0 || lyman + half >= region.width)
        throw new Error(`${frame.name}: the across-slit window reaches outside the read window; widen readWindowAngstrom.`);
      for (let y = 0; y < region.height; y++) {
        const distance = Math.abs(y - centre);
        const on = distance <= reduction.airglowOnDiscRadii * frame.radiusPixels;
        const off = distance >= reduction.airglowOffDiscRadii[0] * frame.radiusPixels && distance <= reduction.airglowOffDiscRadii[1] * frame.radiusPixels;
        if (!on && !off) continue;
        if (on) onRows++; else offRows++;
        for (let index = 0; index <= 2 * half; index++) {
          const value = region.values[y * region.width + lyman - half + index]!;
          if (Number.isFinite(value)) (on ? onDisc : offDisc)[index]! += value;
        }
      }
    }
    const chord = Math.max(3, Math.round(2 * visitFrames[0]!.radiusPixels));
    const across = locateAcrossSlit(onDisc, offDisc, onRows, offRows, chord);
    const fitted = !unlit && across.snr > reduction.acrossSlitMinimumSnr &&
      Math.abs(across.offsetPixels) * visitFrames[0]!.plateScaleArcsec < reduction.acrossSlitMaximumOffsetArcsec;
    registrations.push({ visit, frames: visitFrames.length, unlit, rowOffsetPixels: offsets.length ? median(offsets) : 0, rowDetections: offsets.length,
      acrossSlitOffsetPixels: fitted ? across.offsetPixels : 0, acrossSlitSnr: across.snr, acrossSlitFitted: fitted,
      note: `${offsets.length}/${visitFrames.length} frames gave a continuum row; across-slit ${fitted ? 'fitted' : 'set to the slit centre'} ` +
        `(SNR ${across.snr.toFixed(1)}, offset ${(across.offsetPixels * visitFrames[0]!.plateScaleArcsec).toFixed(2)}")` });
  }
  // A visit the continuum never showed takes the median offset of the visits that did. The commanded row is already good to a
  // fraction of a pixel in the median, so this is a small assumption — but it is an assumption, and it is written down.
  const measured = registrations.filter(entry => entry.rowDetections > 0).map(entry => entry.rowOffsetPixels);
  const fallback = median(measured);
  for (const entry of registrations) if (!entry.rowDetections) {
    entry.rowOffsetPixels = fallback;
    entry.note += `; row offset taken from the ${measured.length} visits that gave one (${fallback.toFixed(1)} px)`;
  }
  return registrations;
}

/** Stack every used frame into one accumulator per line and subset. */
export async function stackFrames(definition: LineStackDefinition, directory: string, frames: readonly PreparedFrame[],
  registration: readonly VisitRegistration[], handedness: Handedness): Promise<StackSet[]> {
  const reduction = definition.reduction, grid = definition.grid;
  const sets: StackSet[] = definition.lines.flatMap(line => definition.subsets.map(subset => ({ line, subset: subset.id, accumulator: newAccumulator(grid.pixels) })));
  const byVisit = new Map(registration.map(entry => [entry.visit, entry]));
  for (const frame of frames) {
    const placement = byVisit.get(frame.visit);
    if (!placement) throw new Error(`${frame.name}: visit ${frame.visit} was not registered.`);
    const region = await readFrameRegion(resolve(directory, frame.name), frame, reduction.readWindowAngstrom);
    const row = discRow(frame, placement);
    const masked = (column: number) => { const angstrom = region.angstromAt(column); return reduction.lineMaskAngstrom.some(([low, high]) => angstrom >= low && angstrom <= high); };
    const sky = skyByColumn(region, row, reduction);
    const sunlight = reflectedSunlight(region, sky, frame, row, reduction, masked);
    const rotation = (frame.ephemeris.northPoleAngleDegrees - frame.orientatDegrees) * DEGREE;
    const subsets = definition.subsets.filter(subset => inSubset({ targetName: frame.targetName, eastOfPrimary: frame.ephemeris.eastOfPrimary }, subset));
    for (const line of definition.lines) {
      const lineColumn = region.columnAt(line.wavelengthAngstrom) + placement.acrossSlitOffsetPixels;
      const rayleigh = rayleighPerSample(frame.continuumToEmissionLineAngstrom, line.wavelengthAngstrom);
      // The reflected continuum under this line, read across the masked columns from the amplitude either side of it.
      let continuum: (offset: number) => number = () => 0;
      if (line.removeReflectedContinuum) {
        const first = Math.ceil(lineColumn - reduction.continuumFitHalfWidthPixels), last = Math.floor(lineColumn + reduction.continuumFitHalfWidthPixels);
        if (first < 0 || last > region.width - 1) throw new Error(`${frame.name}: the ${line.id} continuum window reaches outside the read window; widen readWindowAngstrom.`);
        const points: [number, number][] = [];
        for (let column = first; column <= last; column++) if (!masked(column)) points.push([column - lineColumn, sunlight.amplitude[column]!]);
        continuum = quadraticFit(points);
      }
      const accumulators = sets.filter(set => set.line.id === line.id && subsets.some(subset => subset.id === set.subset));
      for (const set of accumulators) { set.accumulator.exposureSeconds += frame.exposureSeconds; set.accumulator.frames.push(frame.rootname); }
      for (let outputRow = 0; outputRow < grid.pixels; outputRow++) for (let outputColumn = 0; outputColumn < grid.pixels; outputColumn++) {
        const point = gridPoint(grid, outputColumn, outputRow);
        const sample = sampleFor(point, { lineColumn, discRow: row, radiusPixels: frame.radiusPixels, rotationRadians: rotation, handedness });
        if (sample.column < 0 || sample.column >= region.width || sample.row < 0 || sample.row >= region.height) continue;
        const raw = region.values[sample.row * region.width + sample.column]!;
        if (!Number.isFinite(raw) || raw === 0) continue;
        const onDisc = Math.abs(sample.row - row) <= reduction.discProfileHalfHeightRadii * frame.radiusPixels;
        const reflected = line.removeReflectedContinuum && onDisc ? continuum(sample.column - lineColumn) * (sunlight.profile[sample.row - sunlight.firstRow] ?? 0) : 0;
        const brightness = (raw - sky[sample.column]! - (Number.isFinite(reflected) ? reflected : 0)) * rayleigh;
        if (!Number.isFinite(brightness)) continue;
        const index = outputRow * grid.pixels + outputColumn;
        for (const set of accumulators) addSample(set.accumulator, index, brightness, frame.exposureSeconds);
      }
    }
  }
  return sets;
}

// ---- products ---------------------------------------------------------------------------------------------------------
/** The image, written bottom row first as FITS stores an image, in the double precision the stack carries. */
function imageExtension(values: Float64Array, pixels: number, name: string, cards: readonly Card[]): Buffer {
  const data = Buffer.alloc(pixels * pixels * 8);
  for (let row = 0; row < pixels; row++) for (let column = 0; column < pixels; column++)
    data.writeDoubleBE(values[(pixels - 1 - row) * pixels + column]!, (row * pixels + column) * 8);
  return Buffer.concat([headerBlock([['XTENSION', 'IMAGE', 'image extension'], ['BITPIX', -64], ['NAXIS', 2], ['NAXIS1', pixels], ['NAXIS2', pixels],
    ['PCOUNT', 0], ['GCOUNT', 1], ['EXTNAME', name], ...cards]), padBlock(data)]);
}

/** One line and subset as a FITS file: the exposure-weighted mean in Rayleigh, its standard error, and what the picture is. */
export function stackProduct(definition: LineStackDefinition, set: StackSet, handedness: Handedness): Buffer {
  const { values, errors } = accumulatedImage(set.accumulator), pixels = definition.grid.pixels;
  const scale = 2 * definition.grid.halfWidthRadii / pixels;
  const cards: Card[] = [
    ['TARGNAME', definition.target], ['INSTRUME', definition.instrument], ['OPT_ELEM', definition.opticalElement],
    ['LINE', set.line.id], ['WAVELEN', set.line.wavelengthAngstrom, 'Angstrom, the line extracted'], ['SUBSET', set.subset],
    ['BUNIT', 'R', 'Rayleigh, surface brightness'], ['CTYPE1', 'BODYRADII', 'body radii from the body centre'], ['CTYPE2', 'BODYRADII'],
    ['CDELT1', scale, 'body radii per pixel'], ['CDELT2', scale, 'body radii per pixel'],
    ['CRPIX1', (pixels + 1) / 2], ['CRPIX2', (pixels + 1) / 2], ['CRVAL1', 0], ['CRVAL2', 0],
    ['BODYRAD', definition.bodyRadiusKm, 'km, the radius one unit stands for'],
    ['ORIENT', 'body north up, celestial east left'], ['HANDEDNS', handedness, 'image +x of the exposure on the sky'],
    ['NFRAMES', new Set(set.accumulator.frames).size], ['EXPTIME', set.accumulator.exposureSeconds, 'seconds, summed over the frames'],
    ['STACKID', definition.id], ['ORIGIN', 'cssEarth tools/objects/hst/line-stack.mts'],
  ];
  return Buffer.concat([
    headerBlock([['SIMPLE', true, 'conforms to FITS standard'], ['BITPIX', 8], ['NAXIS', 0], ['EXTEND', true], ...cards]),
    imageExtension(values, pixels, 'SCI', [...cards]),
    imageExtension(errors, pixels, 'ERR', [...cards.filter(card => card[0] !== 'BUNIT'), ['BUNIT', 'R', 'Rayleigh, standard error of the mean']]),
  ]);
}

export interface SetMeasurement {
  readonly set: string; readonly line: string; readonly subset: string; readonly frames: number; readonly exposureHours: number;
  readonly discMeanRayleigh: number; readonly aboveLimbMeanRayleigh: number; readonly duskDawnRatio: number; readonly duskDawnRatioAboveLimb: number;
  readonly centroidRadii: readonly [number, number]; readonly peakRayleigh: number;
  readonly pedestalRayleigh: number; readonly limbRayleigh: number; readonly eFoldingKm: number;
}
/** What one stacked set says, in the numbers a receipt states. */
export function measureSet(definition: LineStackDefinition, set: StackSet): SetMeasurement {
  const { values } = accumulatedImage(set.accumulator), metrics = discMetrics(values, definition.grid), fall = limbFallOff(values, definition.grid, definition.bodyRadiusKm);
  return { set: `${set.line.id}-${set.subset}`, line: set.line.id, subset: set.subset, frames: new Set(set.accumulator.frames).size,
    exposureHours: set.accumulator.exposureSeconds / 3600, ...metrics, pedestalRayleigh: fall.pedestalRayleigh, limbRayleigh: fall.limbRayleigh, eFoldingKm: fall.eFoldingKm };
}

/** The version of the software that stacked a set. There is no installed toolchain here: the reduction is this repository's
 * own TypeScript, so what a record can state is the digest of the modules that do the arithmetic. */
export async function lineStackSoftware(): Promise<ProductSoftware[]> {
  const sources = await Promise.all(['line-stack.mts', 'line-stack-reduction.mts', 'line-stack-ephemeris.mts']
    .map(name => readFile(resolve(import.meta.dirname, name))));
  return [{ name: 'cssearth tools/objects/hst/line-stack.mts', version: sha256(Buffer.concat(sources)) }];
}

/** What identifies one stacked set: the frames that went into this one at their pinned sizes and digests, the definition and
 * the pinned Horizons responses that placed them, and the line, subset and grid it was stacked on. */
/** Frame digests measured while the stack read its frames; a receipt names what was actually read, not a pin. */
const measuredFrameDigests = new Map<string, string>();
export async function stackRun(definition: LineStackDefinition, line: StackLine, subset: string, frames: readonly string[],
  software: readonly ProductSoftware[]): Promise<ProductRun> {
  const pinned = new Map(definition.frames.map(frame => [frame.name, frame]));
  const inputs: ProductInput[] = [
    { role: 'stack definition', identity: `tools/objects/hst/programs/${definition.id}.stack.json`, ...await fileSize(stackPath(definition.id)) },
    { role: 'Horizons responses', identity: `tools/objects/hst/programs/${definition.horizons.responses}`, ...await fileSize(resolve(PROGRAMS, definition.horizons.responses)) },
    ...[...frames].sort().map(name => {
      const frame = pinned.get(name);
      if (!frame) throw new Error(`${name} went into the stack but is not a frame the definition pins.`);
      return { role: `frame, programme ${frame.programme}`, identity: frame.uri, bytes: frame.bytes };
    }),
  ];
  return {
    telescope: 'HST', stage: 'line-stack', inputs,
    parameters: { stack: definition.id, target: definition.target, instrument: definition.instrument, opticalElement: definition.opticalElement,
      line: line.id, wavelengthAngstrom: line.wavelengthAngstrom, removeReflectedContinuum: line.removeReflectedContinuum, subset,
      handedness: definition.handedness, gridPixels: definition.grid.pixels, gridHalfWidthRadii: definition.grid.halfWidthRadii,
      bodyRadiusKm: definition.bodyRadiusKm },
    software,
  };
}

/** Everything one run of the stage produced, written where the caller asked for it, each product beside the record of the run
 * that made it. A record's evidence list is empty here: what a stack was checked against is added by the stage that checked
 * it, from the receipt (`addStackEvidence`). */
export async function writeProducts(definition: LineStackDefinition, run: LineStackRun, outputDirectory: string) {
  await mkdir(outputDirectory, { recursive: true });
  const written: string[] = [], software = await lineStackSoftware();
  for (const set of run.sets) {
    if (!set.accumulator.frames.length) continue;
    const name = `${set.line.id}-${set.subset}.fits`;
    await writeFile(resolve(outputDirectory, name), stackProduct(definition, set, run.handedness));
    await writeProductRecord(productRecordPath(resolve(outputDirectory, name)),
      await stackRun(definition, set.line, set.subset, [...new Set(set.accumulator.frames)], software),
      [{ path: name, file: resolve(outputDirectory, name), units: 'R',
        conventions: { grid: 'body radii from the body centre, body north up and celestial east left', handedness: run.handedness,
          extensions: 'SCI the exposure-weighted mean surface brightness, ERR its standard error' } }]);
    written.push(name);
  }
  const profiles: Record<string, unknown> = {};
  for (const set of run.sets) {
    if (!set.accumulator.frames.length) continue;
    profiles[`${set.line.id}-${set.subset}`] = radialProfile(accumulatedImage(set.accumulator).values, set.accumulator.weight, definition.grid, 0.125);
  }
  await writeFile(resolve(outputDirectory, 'registration.json'), `${JSON.stringify({ stack: definition.id, handedness: run.handedness,
    frames: run.frames.map(frame => ({ name: frame.name, visit: frame.visit, programme: frame.programme, targetName: frame.targetName,
      exposureSeconds: frame.exposureSeconds, primaryLimbClearanceArcsec: frame.ephemeris.primaryLimbClearanceArcsec,
      eastOfPrimary: frame.ephemeris.eastOfPrimary, rejected: frame.rejected })),
    visits: run.registration }, null, 1)}\n`);
  await writeFile(resolve(outputDirectory, 'radial-profiles.json'), `${JSON.stringify(profiles, null, 1)}\n`);
  return written;
}

// ---- the stage --------------------------------------------------------------------------------------------------------
export const stackPath = (id: string) => resolve(PROGRAMS, `${id}.stack.json`);
export const readLineStack = async (id: string) => parseLineStack(JSON.parse(await readFile(stackPath(id), 'utf8')));

export interface LineStackOptions {
  readonly directory: string;
  /** Whether a Horizons request the pinned responses do not answer may be made. A pinned run asks for nothing. */
  readonly mayAsk?: boolean;
  readonly verifyDigests?: boolean;
  /** Stack the opposite handedness as well, which is the evidence for the one adopted. */
  readonly mirror?: boolean;
  readonly log?: (line: string) => void;
}
/** One run of the stage: the frames, where each visit was placed, the adopted stack and, when asked for, the mirrored one. */
export async function runLineStack(definition: LineStackDefinition, options: LineStackOptions): Promise<LineStackRun & { mirrored?: readonly StackSet[] }> {
  const log = options.log ?? (() => {});
  const frames = await prepareFrames(definition, options.directory, options.mayAsk ?? false, options.verifyDigests ?? true);
  const used = frames.filter(frame => !frame.rejected);
  log(`${used.length} of ${frames.length} frames used, ${frames.length - used.length} rejected`);
  const registration = await registerVisits(definition, options.directory, used);
  for (const visit of registration) log(`${visit.visit} row ${visit.rowOffsetPixels.toFixed(1).padStart(6)} px  across-slit ${visit.acrossSlitOffsetPixels.toFixed(1).padStart(6)} px  ${visit.note}`);
  const sets = await stackFrames(definition, options.directory, used, registration, definition.handedness);
  const mirrored = options.mirror
    ? await stackFrames(definition, options.directory, used, registration, definition.handedness === 'ORIENTAT-90' ? 'ORIENTAT+90' : 'ORIENTAT-90')
    : undefined;
  return { definition, handedness: definition.handedness, frames, used, registration, sets, ...mirrored ? { mirrored } : {} };
}

/** The receipt: what was stacked, what it measures, what a published value says beside it, and what is not verified. */
export function stackReceipt(run: LineStackRun & { mirrored?: readonly StackSet[] }) {
  const definition = run.definition, measurements = run.sets.filter(set => set.accumulator.frames.length).map(set => measureSet(definition, set));
  const byReason = new Map<string, number>();
  for (const frame of run.frames) if (frame.rejected) byReason.set(frame.rejected, (byReason.get(frame.rejected) ?? 0) + 1);
  const byProgramme = new Map<string, number>();
  for (const frame of run.used) byProgramme.set(frame.programme, (byProgramme.get(frame.programme) ?? 0) + 1);
  const rowOffsets = run.registration.filter(visit => visit.rowDetections).map(visit => visit.rowOffsetPixels);
  const acrossOffsets = run.registration.filter(visit => visit.acrossSlitFitted).map(visit => visit.acrossSlitOffsetPixels);
  const range = (values: readonly number[]) => values.length ? [Math.min(...values), Math.max(...values)] : [];
  const measured = new Map(measurements.map(entry => [entry.set, entry]));
  return {
    schema: 'cssearth-hst-line-stack-reproduction@1',
    stack: definition.id,
    definition: `tools/objects/hst/programs/${definition.id}.stack.json`,
    target: definition.target, instrument: definition.instrument, opticalElement: definition.opticalElement,
    handedness: definition.handedness,
    frames: {
      pinned: definition.frames.length, used: run.used.length, visits: run.registration.length,
      exposureHours: run.used.reduce((total, frame) => total + frame.exposureSeconds, 0) / 3600,
      byProgramme: Object.fromEntries([...byProgramme].sort()),
      rejected: [...byReason].sort().map(([reason, frames]) => ({ reason, frames })),
    },
    registration: {
      visitsWithMeasuredRow: rowOffsets.length, visitsWithAssumedRow: run.registration.length - rowOffsets.length,
      rowOffsetRangePixels: range(rowOffsets), rowOffsetFallbackPixels: run.registration.find(visit => !visit.rowDetections)?.rowOffsetPixels ?? null,
      visitsWithFittedAcrossSlit: acrossOffsets.length, visitsWithAssumedAcrossSlit: run.registration.length - acrossOffsets.length,
      acrossSlitOffsetRangePixels: range(acrossOffsets),
      visits: run.registration,
    },
    sets: measurements,
    published: definition.published.map(value => ({ ...value,
      measured: value.set && value.metric ? (measured.get(value.set) as unknown as Record<string, number> | undefined)?.[value.metric] ?? null : null })),
    mirroredHandedness: run.mirrored?.filter(set => set.accumulator.frames.length).map(set => {
      const mirror = measureSet(definition, set);
      return { set: mirror.set, adoptedDuskDawnRatio: measured.get(mirror.set)?.duskDawnRatio ?? null, mirroredDuskDawnRatio: mirror.duskDawnRatio };
    }) ?? null,
    measured: definition.notes.measured,
    notVerified: definition.notes.notVerified,
  };
}

/** The two checks the receipt makes, as much of it as the evidence needs. */
export interface StackChecks {
  readonly sets: readonly { readonly set: string }[];
  readonly published: readonly { readonly quantity: string; readonly source: string; readonly set?: string; readonly measured: number | null }[];
  readonly mirroredHandedness: readonly { readonly set: string }[] | null;
}

/** What the receipt's own checks establish, added to the record of the run that stacked each set. The two are not the same
 * evidence and are not recorded as one: a published value is a number someone else measured, and the mirrored handedness is
 * this repository's own second reduction of the same frames. A set with no record is refused rather than reported as
 * checked. */
export async function addStackEvidence(outputDirectory: string, receipt: string, checks: StackChecks) {
  const records: string[] = [];
  for (const { set } of checks.sets) {
    const product = `${set}.fits`, compared = checks.published.filter(value => value.set === set && value.measured !== null), entries: ProductEvidence[] = [];
    if (compared.length) entries.push({ kind: 'published-value', receipt, product,
      establishes: `${receipt} puts this set's ${compared.map(value => value.quantity).join(', ')} beside the published ${compared.map(value => value.source).join('; ')}. ` +
        'It establishes that this reduction comes to a number someone else measured from the same telescope\'s exposures, as closely as the receipt states beside the ' +
        'uncertainty they published; it establishes nothing about the quantities they did not publish.' });
    if (checks.mirroredHandedness?.some(entry => entry.set === set)) entries.push({ kind: 'internal-consistency', receipt, product,
      establishes: `The same frames were stacked again at the opposite handedness and ${receipt} states what each stack came to. It establishes that the asymmetry ` +
        'follows the orientation adopted rather than the grid it is drawn on; both stacks are this repository\'s own reduction of the same frames, so nothing outside ' +
        'them is checked by it.' });
    if (!entries.length) continue;
    await addProductEvidence(productRecordPath(resolve(outputDirectory, product)), entries, output => resolve(outputDirectory, output), name => resolve(name));
    records.push(productRecordPath(product));
  }
  return records;
}

/** What each stacked set came to, for a run's own log. */
function measurementsOf(run: LineStackRun) {
  return run.sets.filter(set => set.accumulator.frames.length).map(set => measureSet(run.definition, set));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), flags = args.filter(argument => argument.startsWith('--')), rest = args.filter(argument => !argument.startsWith('--'));
  const [id, directory, output] = rest;
  if (!id || !directory || !output) {
    console.error('usage: line-stack.mts <stack id> <frames directory> <output directory> [--fetch] [--receipt] [--mirror] [--no-verify]');
    process.exit(2);
  }
  const unknown = flags.filter(flag => !['--fetch', '--receipt', '--mirror', '--no-verify'].includes(flag));
  if (unknown.length) { console.error(`unknown option ${unknown.join(' ')}`); process.exit(2); }
  const definition = await readLineStack(id);
  const run = await runLineStack(definition, { directory, mayAsk: flags.includes('--fetch'), verifyDigests: !flags.includes('--no-verify'),
    mirror: flags.includes('--mirror'), log: line => console.log(line) });
  const written = await writeProducts(definition, run, output);
  for (const entry of measurementsOf(run)) console.log(`${entry.set.padEnd(18)} frames ${String(entry.frames).padStart(3)}  ${entry.exposureHours.toFixed(1).padStart(5)} h  ` +
    `disc ${entry.discMeanRayleigh.toFixed(1).padStart(6)} R  dusk/dawn ${entry.duskDawnRatio.toFixed(2)}  e-folding ${entry.eFoldingKm.toFixed(0)} km`);
  console.log(`wrote ${written.length} products to ${output}`);
  if (flags.includes('--receipt')) {
    const path = resolve(PROGRAMS, `${definition.id}.stack.reproduction.json`), receipt = stackReceipt(run);
    await writeFile(path, `${JSON.stringify(receipt, null, 1)}\n`);
    const records = await addStackEvidence(output, path, receipt);
    console.log(`wrote ${path}, and its evidence into ${records.length} product records`);
  }
}
