/** The STIS slit-scan frames a map is read from: their headers, background-subtracted read windows and row spectra, the
 * geometry of every exposure from Horizons, and where the body sat in each visit, measured from the scan itself. */
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FitsHeader } from '@cssearth/fits';
import { readFitsFileHdus, readFitsFileRegion, type FitsFileHdu } from '@cssearth/fits/node';
import { PROGRAMS } from './archive.mts';
import { horizonsColumn, horizonsResponse, matchHorizonsEpochs, parseHorizonsTable, readHorizonsResponses, writeHorizonsResponses, type HorizonsResponses } from './line-stack-ephemeris.mts';
import { acrossSlitCentre, discChord, type Chord, type SlitScanDefinition } from './slit-scan-reduction.mts';

export const MJD_TO_JD = 2400000.5, ARCSEC_PER_RADIAN = 206264.806247, DEGREE = Math.PI / 180;
/** Characters 1-6 of a rootname are the HST visit: one scan of the disc, at one pointing and one roll. */
const VISIT_LENGTH = 6;
export const REPOSITORY = resolve(import.meta.dirname, '../../..');

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

// ---- frames -----------------------------------------------------------------------------------------------------------
export interface ScanFrameHeader {
  readonly name: string; readonly rootname: string; readonly visit: string; readonly programme: string; readonly targetName: string;
  readonly aperture: string; readonly opticalElement: string;
  readonly exposureSeconds: number; readonly startMjd: number; readonly endMjd: number;
  /** The commanded offsets along the aperture's two axes, arcseconds: `POSTARG1` across the slit, `POSTARG2` along it. */
  readonly postArg1Arcsec: number; readonly postArg2Arcsec: number;
  /** Position angle of the slit on the sky, degrees east of north: the `+AXIS2` the rows grow along. */
  readonly orientatDegrees: number;
  readonly crpix1: number; readonly crpix2: number; readonly crval1: number;
  readonly dispersionAngstrom: number; readonly plateScaleArcsec: number;
  readonly width: number; readonly height: number; readonly science: FitsFileHdu; readonly errors: FitsFileHdu;
}

/** One rectified frame's headers. Only header blocks are read; the image is read a region at a time, later. */
export async function readScanFrameHeader(path: string, name: string): Promise<ScanFrameHeader> {
  const hdus = await readFitsFileHdus(path), primary = hdus[0]?.header, science = hdus[1], errors = hdus[2];
  if (!primary || !science || !errors || science.dimensions.length !== 2 || errors.dimensions.length !== 2)
    throw new Error(`${name} is not a rectified two-axis product with an error array.`);
  const rootname = cardText(primary, 'ROOTNAME', name).toLowerCase();
  if (!name.startsWith(rootname)) throw new Error(`${name} carries rootname ${rootname}.`);
  return {
    name, rootname, visit: rootname.slice(0, VISIT_LENGTH), programme: String(cardNumber(primary, 'PROPOSID', name)),
    targetName: cardText(primary, 'TARGNAME', name), aperture: cardText(primary, 'APERTURE', name), opticalElement: cardText(primary, 'OPT_ELEM', name),
    exposureSeconds: cardNumber(primary, 'TEXPTIME', name), startMjd: cardNumber(primary, 'TEXPSTRT', name), endMjd: cardNumber(primary, 'TEXPEND', name),
    postArg1Arcsec: cardNumber(primary, 'POSTARG1', name), postArg2Arcsec: cardNumber(primary, 'POSTARG2', name),
    orientatDegrees: cardNumber(science.header, 'ORIENTAT', name),
    crpix1: cardNumber(science.header, 'CRPIX1', name), crpix2: cardNumber(science.header, 'CRPIX2', name), crval1: cardNumber(science.header, 'CRVAL1', name),
    dispersionAngstrom: cardNumber(science.header, 'CD1_1', name), plateScaleArcsec: cardNumber(science.header, 'CD2_2', name) * 3600,
    width: science.dimensions[0]!, height: science.dimensions[1]!, science, errors,
  };
}

/** The read window of one frame with its background taken off: every column between two wavelengths, every row, science and
 * error side by side. The background is each column's median over the rows a stated distance from the body, which on a
 * subarray this small is the detector's own scattered light and the sky together. */
interface FrameRegion {
  readonly x0: number; readonly width: number; readonly height: number;
  readonly flux: Float64Array; readonly error: Float64Array; readonly wavelengthAngstrom: Float64Array;
}
export async function readFrameRegion(path: string, frame: ScanFrameHeader, definition: SlitScanDefinition, commandedRow: number): Promise<FrameRegion> {
  const window = definition.band.readWindowAngstrom;
  const detectorColumn = (angstrom: number) => frame.crpix1 - 1 + (angstrom - frame.crval1) / frame.dispersionAngstrom;
  const x0 = Math.round(detectorColumn(window[0])), x1 = Math.round(detectorColumn(window[1]));
  // The whole window has to be on the detector: a window read short would leave every later step working on fewer columns
  // than it asked for, and a row read past its end runs on into the next row.
  if (x0 < 0 || x1 > frame.width - 1 || x1 <= x0) throw new Error(`${frame.name} does not hold ${window[0]}-${window[1]} Å.`);
  const width = x1 - x0 + 1, height = frame.height;
  const science = await readFitsFileRegion(path, frame.science, { x0, y0: 0, width, height });
  const errors = await readFitsFileRegion(path, frame.errors, { x0, y0: 0, width, height });
  const [near, far] = definition.reduction.skyRowsFromDisc, background = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const sample: number[] = [];
    for (let y = 0; y < height; y++) {
      const distance = Math.abs(y - commandedRow);
      if (distance < near || distance > far) continue;
      const value = science.values[y * width + x]!;
      if (Number.isFinite(value)) sample.push(value);
    }
    sample.sort((a, b) => a - b);
    background[x] = sample.length ? sample[sample.length >> 1]! : 0;
  }
  const flux = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) flux[y * width + x] = science.values[y * width + x]! - background[x]!;
  const wavelengthAngstrom = new Float64Array(width);
  for (let x = 0; x < width; x++) wavelengthAngstrom[x] = frame.crval1 + (x + x0 - (frame.crpix1 - 1)) * frame.dispersionAngstrom;
  return { x0, width, height, flux, error: errors.values, wavelengthAngstrom };
}

/** One actual detector row from a pinned rectified product. */
export interface SlitRegionSpectrum {
  readonly frame: string; readonly visit: string; readonly row: number;
  readonly alongSlitArcsec: number; readonly acrossSlitArcsec: number;
  readonly wavelengthAngstrom: readonly number[]; readonly flux: readonly number[]; readonly error: readonly number[];
}

/** Extract one background-subtracted STIS row. Either a checked scan registration is supplied by the pinned receipt, or the
 * complete pinned scan is registered here; neither path expands receipt values into detector data. */
export async function extractSlitRegionSpectrum(definition: SlitScanDefinition, options: {
  readonly directory: string; readonly frame: string; readonly row: number; readonly mayAsk?: boolean; readonly verifyDigests?: boolean;
  readonly registration?: Pick<VisitRegistration, 'visit' | 'discRow' | 'acrossSlitCentreArcsec'>;
}): Promise<SlitRegionSpectrum> {
  if (!Number.isSafeInteger(options.row) || options.row < 0) throw new RangeError('A slit-region row is a non-negative detector row.');
  const pinned = definition.frames.find(candidate => candidate.name === options.frame);
  if (!pinned) throw new Error(`${options.frame} is not a pinned slit-scan frame.`);
  const path = resolve(options.directory, pinned.name), header = await readScanFrameHeader(path, pinned.name);
  if (header.programme !== pinned.programme || header.targetName !== pinned.targetName || header.aperture !== definition.aperture || header.opticalElement !== definition.opticalElement)
    throw new Error(`${pinned.name} does not match its pinned STIS scan identity.`);
  if (options.verifyDigests ?? true) { if ((await stat(path)).size !== pinned.bytes) throw new Error(`${pinned.name}: the file on disk is not the recorded size.`); }
  const frame = header;
  if (options.row >= frame.height) throw new RangeError(`${options.frame} has ${frame.height} rows, not row ${options.row}.`);
  const visit = options.registration ?? (await (async () => {
    const frames = await prepareFrames(definition, options.directory, options.mayAsk ?? false, options.verifyDigests ?? true);
    return (await registerVisits(definition, options.directory, frames)).find(candidate => candidate.visit === frame.visit);
  })());
  if (!visit) throw new Error(`${frame.name} has no registered visit.`);
  if (visit.visit !== frame.visit) throw new Error(`${frame.name} does not match the supplied scan registration.`);
  const commandedRow = frame.crpix2 - 1 + frame.postArg2Arcsec / frame.plateScaleArcsec;
  const region = await readFrameRegion(path, frame, definition, commandedRow);
  const offset = options.row * region.width;
  return { frame: frame.name, visit: visit.visit, row: options.row,
    alongSlitArcsec: (options.row - visit.discRow) * frame.plateScaleArcsec,
    acrossSlitArcsec: frame.postArg1Arcsec - visit.acrossSlitCentreArcsec,
    wavelengthAngstrom: Array.from(region.wavelengthAngstrom), flux: Array.from(region.flux.subarray(offset, offset + region.width)),
    error: Array.from(region.error.subarray(offset, offset + region.width)) };
}

/** The body's own profile along the slit: the reflected sunlight of every row over a window with no band in it. */
function slitProfile(region: FrameRegion, definition: SlitScanDefinition): number[] {
  const [low, high] = definition.reduction.discProfileWindowAngstrom, profile: number[] = [];
  for (let y = 0; y < region.height; y++) {
    let total = 0, samples = 0;
    for (let x = 0; x < region.width; x++) {
      const angstrom = region.wavelengthAngstrom[x]!;
      if (angstrom < low || angstrom > high) continue;
      const value = region.flux[y * region.width + x]!;
      if (Number.isFinite(value)) { total += value; samples++; }
    }
    profile.push(samples ? total / samples : 0);
  }
  return profile;
}

// ---- geometry ---------------------------------------------------------------------------------------------------------
export interface FrameEphemeris {
  readonly julianDate: number; readonly rightAscensionDegrees: number; readonly declinationDegrees: number;
  readonly rangeAu: number; readonly angularDiameterArcsec: number; readonly northPoleAngleDegrees: number;
  readonly sunRightAscensionDegrees: number; readonly sunDeclinationDegrees: number;
}
/** Every exposure's geometry, asked for in batches of the pinned size, each row matched back to its epoch by its own
 * timestamp: Horizons returns a `TLIST` sorted by time rather than in the order asked for. */
export async function scanEphemerides(definition: SlitScanDefinition, responses: HorizonsResponses, julianDates: readonly number[], mayAsk: boolean): Promise<FrameEphemeris[]> {
  const horizons = definition.horizons, out: FrameEphemeris[] = [];
  for (let start = 0; start < julianDates.length; start += horizons.epochsPerRequest) {
    const batch = julianDates.slice(start, start + horizons.epochsPerRequest);
    const target = parseHorizonsTable(await horizonsResponse(responses, horizons.observer, horizons.target, horizons.targetQuantities, batch, mayAsk));
    const sun = parseHorizonsTable(await horizonsResponse(responses, horizons.sunObserver, horizons.sun, horizons.sunQuantities, batch, mayAsk));
    const targetRows = matchHorizonsEpochs(target, batch), sunRows = matchHorizonsEpochs(sun, batch);
    const value = (table: ReturnType<typeof parseHorizonsTable>, row: readonly string[], prefix: string, label: string) => {
      const found = Number(row[horizonsColumn(table, prefix)]);
      if (!Number.isFinite(found)) throw new Error(`Horizons gave no ${label}.`);
      return found;
    };
    batch.forEach((julianDate, index) => out.push({ julianDate,
      rightAscensionDegrees: value(target, targetRows[index]!, 'R.A.', 'right ascension'),
      declinationDegrees: value(target, targetRows[index]!, 'DEC', 'declination'),
      rangeAu: value(target, targetRows[index]!, 'delta', 'range'),
      angularDiameterArcsec: value(target, targetRows[index]!, 'Ang-diam', 'angular diameter'),
      northPoleAngleDegrees: value(target, targetRows[index]!, 'NP.ang', 'north pole angle'),
      sunRightAscensionDegrees: value(sun, sunRows[index]!, 'R.A.', 'solar right ascension'),
      sunDeclinationDegrees: value(sun, sunRows[index]!, 'DEC', 'solar declination') }));
  }
  return out;
}

export interface PreparedFrame extends ScanFrameHeader {
  readonly ephemeris: FrameEphemeris;
  readonly radiusArcsec: number;
  /** The row the pointing commands, before the disc is found. */
  readonly commandedRow: number;
  readonly rejected: string;
}

/** Every pinned frame, with its headers checked against the pin and its geometry from Horizons. */
export async function prepareFrames(definition: SlitScanDefinition, directory: string, mayAsk: boolean, verifyDigests: boolean): Promise<PreparedFrame[]> {
  const headers: ScanFrameHeader[] = [];
  for (const pinned of definition.frames) {
    const path = resolve(directory, pinned.name), header = await readScanFrameHeader(path, pinned.name);
    if (header.programme !== pinned.programme || header.targetName !== pinned.targetName)
      throw new Error(`${pinned.name}: the file is programme ${header.programme} target ${header.targetName}, the pin says ${pinned.programme} ${pinned.targetName}.`);
    if (header.aperture !== definition.aperture || header.opticalElement !== definition.opticalElement)
      throw new Error(`${pinned.name}: the file is ${header.aperture} ${header.opticalElement}, the scan is ${definition.aperture} ${definition.opticalElement}.`);
    if (verifyDigests) {
      if ((await stat(path)).size !== pinned.bytes) throw new Error(`${pinned.name}: the file on disk is not the recorded size.`);
    }
    headers.push(header);
  }
  const responsesPath = resolve(PROGRAMS, definition.horizons.responses), responses = await readHorizonsResponses(responsesPath);
  const before = Object.keys(responses).length;
  const ephemerides = await scanEphemerides(definition, responses, headers.map(header => (header.startMjd + header.endMjd) / 2 + MJD_TO_JD), mayAsk);
  if (Object.keys(responses).length !== before) await writeHorizonsResponses(responsesPath, responses);
  return headers.map((header, index) => ({ ...header, ephemeris: ephemerides[index]!, radiusArcsec: ephemerides[index]!.angularDiameterArcsec / 2,
    commandedRow: header.crpix2 - 1 + header.postArg2Arcsec / header.plateScaleArcsec, rejected: definition.frames[index]!.rejected ?? '' }));
}

export interface VisitRegistration {
  readonly visit: string; readonly frames: number; readonly programme: string; readonly targetName: string;
  /** The body's centre along the slit, in detector rows, and across it, in commanded arcseconds. */
  readonly discRow: number; readonly acrossSlitCentreArcsec: number;
  /** How well the chords a scan cut agree with a disc of the ephemeris radius at that centre, and how many crossed it. */
  readonly chordRmsArcsec: number; readonly chordSteps: number;
  readonly radiusArcsec: number; readonly orientatDegrees: number; readonly midJulianDate: number;
}

/** Where the body sat in each visit, measured from the scan itself.
 *
 * Along the slit, the body is a top hat as wide as its chord, so the middle of that chord is its centre; the visit takes the
 * median of the steps that crossed it. Across the slit, the chords themselves say where the centre is: a step at distance `d`
 * from it cuts `sqrt(R² − d²)`, and the offset that best explains the whole scan is the answer. Both are measurements, and the
 * residual of the second is reported so a scan that did not fit a disc cannot pass unnoticed. */
export async function registerVisits(definition: SlitScanDefinition, directory: string, frames: readonly PreparedFrame[]): Promise<VisitRegistration[]> {
  const byVisit = new Map<string, PreparedFrame[]>();
  for (const frame of frames) (byVisit.get(frame.visit) ?? byVisit.set(frame.visit, []).get(frame.visit)!).push(frame);
  const registrations: VisitRegistration[] = [];
  for (const [visit, visitFrames] of byVisit) {
    const chords: (Chord & { frame: PreparedFrame })[] = [];
    for (const frame of visitFrames) {
      const region = await readFrameRegion(resolve(directory, frame.name), frame, definition, frame.commandedRow);
      chords.push({ ...discChord(slitProfile(region, definition), frame.commandedRow, definition.reduction, frame.plateScaleArcsec), frame });
    }
    const crossing = chords.filter(chord => chord.halfChordArcsec >= definition.reduction.minimumHalfChordArcsec);
    if (!crossing.length) throw new Error(`${visit}: no step crossed the disc.`);
    const rows = crossing.map(chord => chord.centreRow).sort((a, b) => a - b);
    const radiusArcsec = crossing.reduce((total, chord) => total + chord.frame.radiusArcsec, 0) / crossing.length;
    const centre = acrossSlitCentre(chords.map(chord => ({ postArg1Arcsec: chord.frame.postArg1Arcsec, halfChordArcsec: chord.halfChordArcsec })), radiusArcsec, definition.reduction);
    registrations.push({ visit, frames: visitFrames.length, programme: visitFrames[0]!.programme, targetName: visitFrames[0]!.targetName,
      discRow: rows[rows.length >> 1]!, acrossSlitCentreArcsec: centre.offsetArcsec, chordRmsArcsec: centre.rmsArcsec, chordSteps: centre.steps,
      radiusArcsec, orientatDegrees: visitFrames[0]!.orientatDegrees,
      midJulianDate: visitFrames.reduce((total, frame) => total + frame.ephemeris.julianDate, 0) / visitFrames.length });
  }
  return registrations;
}

// ---- the reference spectrum -------------------------------------------------------------------------------------------
