#!/usr/bin/env node
/** Map one absorption band over a body's surface from STIS long-slit spectra scanned across its disc.
 *
 *   node tools/objects/hst/slit-scan-map.mts <scan id> <frames directory> <output directory> [--fetch] [--receipt] [--mirror]
 *
 * A slit narrower than the body, stepped across it, samples the surface on two axes at once: the detector rows along the slit
 * are already a picture, and the steps are the other direction. Every row is a whole spectrum, so a band can be measured in each
 * of them and the measurements laid back on the body. This stage does that, and writes a full-world longitude-latitude map of
 * the band's strength.
 *
 * Nothing about one body or one band is written here. Which frames, which reference spectrum, which continuum windows, which
 * band, which grid and which rotation model all come from a pinned scan definition in `programs/`, beside the raw JPL Horizons
 * responses that place the body; a re-run asks the network for nothing. The first one proven is Europa's irradiated sodium
 * chloride, `programs/europa-salt-map.scan.json`; [docs/hubble.md](../../../docs/hubble.md) says what it measured.
 *
 * The parts that can be checked without a file are in [slit-scan-reduction.mts](slit-scan-reduction.mts). The body geometry is
 * the one every ground-based photograph uses (an IAU pole model from a text PCK through `observerCamera`), and the projection
 * and combination are the ones the JWST cubes and the ALMA thermal maps use, so a slit scan lands on the body the same way an
 * image does.
 *
 * Which way the aperture's first axis lies on the sky is **not assumed**: `--mirror` runs the opposite choice as well and the
 * receipt reports what each one does to the agreement between visits that saw the same ground. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsFileHdus, readFitsHdus, readFitsFileRegion, type FitsFileHdu, type FitsHeader } from '../../fits.mts';
import { sha256File } from '../../../src/platform/sha256.mts';
import { requireFiniteNumber } from '../../source-values.mts';
import { PROGRAMS } from './archive.mts';
import { horizonsColumn, horizonsResponse, matchHorizonsEpochs, parseHorizonsTable, readHorizonsResponses, writeHorizonsResponses, type HorizonsResponses } from './line-stack-ephemeris.mts';
import { observerCamera, type BodyOrientation } from '../terrestrial-layers/observer-camera.mts';
import { loadOrientation } from '../terrestrial-layers/observer-cameras.mts';
import { bodyMapFits, combineBodyMaps, projectBandMap, type BodyMap } from '../jwst/cubes/body-map.mts';
import { combineUnderPolicy, formatBodyMapProduct, type BodyMapFrame, type BodyMapObservation, type BodyMapProduct, type CombinationPolicy, type MeasurementDefinition } from '../body-map-product.mts';
import { sha256 as digestOf } from '../../../src/platform/sha256.mts';
import { bodyMapProductRecord, formatProductRecord } from '../body-map-publication.mts';
import type { ProductInput, ProductSoftware } from '../product-record.mts';
import {
  ACROSS_SLIT_DIRECTIONS, acrossSlitCentre, addFeatureless, bandFromReflectance, discChord, featurelessMean, newFeatureless,
  parseSlitScan, quantiles, ratioAgainst, reflectance, scanImage,
  type AcrossSlitDirection, type Chord, type Reflectance, type ReferenceSpectrum, type SlitScanDefinition, type ScanSampling,
} from './slit-scan-reduction.mts';

const MJD_TO_JD = 2400000.5, ARCSEC_PER_RADIAN = 206264.806247, DEGREE = Math.PI / 180;
/** Characters 1-6 of a rootname are the HST visit: one scan of the disc, at one pointing and one roll. */
const VISIT_LENGTH = 6;
const REPOSITORY = resolve(import.meta.dirname, '../../..');

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
async function readFrameRegion(path: string, frame: ScanFrameHeader, definition: SlitScanDefinition, commandedRow: number): Promise<FrameRegion> {
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
  if (options.verifyDigests ?? true) { const digest = await sha256File(path); if (digest.sha256 !== pinned.sha256) throw new Error(`${pinned.name}: the file on disk is not the pinned one.`); }
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
      const digest = await sha256File(path);
      if (digest.sha256 !== pinned.sha256) throw new Error(`${pinned.name}: the file on disk is not the pinned one.`);
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
/** The pinned reference spectrum, read from the binary table it is distributed as. Only two single-precision columns are
 * taken, named in the definition, and the wavelengths must rise; nothing else about the file is assumed. */
export function readReferenceSpectrum(bytes: Buffer, definition: SlitScanDefinition): ReferenceSpectrum {
  const hdus = readFitsHdus(bytes), table = hdus[1];
  if (!table || table.header.XTENSION !== 'BINTABLE') throw new Error(`${definition.reference.name} holds no binary table.`);
  const header = table.header, fields = requireFiniteNumber(header.TFIELDS, 'TFIELDS'), rowBytes = requireFiniteNumber(header.NAXIS1, 'NAXIS1');
  const rows = requireFiniteNumber(header.NAXIS2, 'NAXIS2');
  let offset = 0, wavelengthOffset = -1, fluxOffset = -1;
  for (let field = 1; field <= fields; field++) {
    const form = String(header[`TFORM${field}`] ?? '').trim(), name = String(header[`TTYPE${field}`] ?? '').trim();
    if (form !== 'E') throw new Error(`${definition.reference.name} column ${name || field} is ${form}, not single precision.`);
    if (name === definition.reference.wavelengthColumn) wavelengthOffset = offset;
    if (name === definition.reference.fluxColumn) fluxOffset = offset;
    offset += 4;
  }
  if (wavelengthOffset < 0 || fluxOffset < 0) throw new Error(`${definition.reference.name} holds no ${definition.reference.wavelengthColumn}/${definition.reference.fluxColumn} columns.`);
  if (offset !== rowBytes) throw new Error(`${definition.reference.name} rows are ${rowBytes} bytes for ${offset} of columns.`);
  const wavelengthAngstrom = new Float64Array(rows), flux = new Float64Array(rows);
  for (let row = 0; row < rows; row++) {
    wavelengthAngstrom[row] = bytes.readFloatBE(table.dataOffset + row * rowBytes + wavelengthOffset);
    flux[row] = bytes.readFloatBE(table.dataOffset + row * rowBytes + fluxOffset);
    if (row && !(wavelengthAngstrom[row]! > wavelengthAngstrom[row - 1]!)) throw new Error(`${definition.reference.name} wavelengths do not rise.`);
  }
  return { wavelengthAngstrom, flux };
}

// ---- the run ----------------------------------------------------------------------------------------------------------
export interface VisitMap { readonly registration: VisitRegistration; readonly camera: ReturnType<typeof observerCamera>; readonly map: BodyMap; readonly sampled: number }
export interface SlitScanRun {
  readonly definition: SlitScanDefinition;
  readonly frames: readonly PreparedFrame[]; readonly used: readonly PreparedFrame[];
  readonly registration: readonly VisitRegistration[];
  readonly direction: AcrossSlitDirection;
  readonly visits: readonly VisitMap[];
  readonly combined: ReturnType<typeof combineBodyMaps>;
  readonly coverage: Float32Array;
  /** The spectrum zero is measured against, and how many rows built it. */
  readonly featureless: FeaturelessSet;
  /** The shared part of every measured row's sigma, the one that came from the featureless spectrum. */
  readonly referenceSigmas: readonly number[];
  /** The same map with the published continuum alone and no common zero, kept so the receipt can state both. */
  readonly firstPass: ReturnType<typeof combineBodyMaps>;
  readonly mirrored?: { readonly direction: AcrossSlitDirection; readonly overlaps: ReturnType<typeof combineBodyMaps>['overlaps']; readonly peak: { latitude: number; westLongitude: number; value: number } };
}

/** Every used frame's band strengths, one sampling per visit. Frames are read one at a time and nothing is held after the
 * band strengths have been taken out of them. With `featureless`, every row is divided by that spectrum first. */
async function sampleVisits(definition: SlitScanDefinition, directory: string, frames: readonly PreparedFrame[],
  registration: readonly VisitRegistration[], reference: ReferenceSpectrum, featureless: Reflectance | null,
  referenceSigmas?: number[]): Promise<Map<string, ScanSampling>> {
  const samplings = new Map<string, ScanSampling>();
  for (const visit of registration) {
    const visitFrames = frames.filter(frame => frame.visit === visit.visit).sort((a, b) => a.postArg1Arcsec - b.postArg1Arcsec);
    const value: (number | null)[][] = [], sigma: number[][] = [];
    for (const frame of visitFrames) {
      const column: (number | null)[] = [], errors: number[] = [];
      for await (const row of frameRows(definition, directory, frame, visit, reference)) {
        const strength = row.reflectance && bandFromReflectance(featureless ? ratioAgainst(row.reflectance, featureless) : row.reflectance, definition.band);
        column.push(strength ? strength.equivalentWidthAngstrom : null); errors.push(strength ? strength.sigmaAngstrom : Number.NaN);
        if (strength && referenceSigmas) referenceSigmas.push(strength.referenceSigmaAngstrom);
      }
      value.push(column); sigma.push(errors);
    }
    samplings.set(visit.visit, { postArg1Arcsec: visitFrames.map(frame => frame.postArg1Arcsec), value, sigma,
      discRow: visit.discRow, acrossSlitCentreArcsec: visit.acrossSlitCentreArcsec,
      plateScaleArcsec: visitFrames[0]!.plateScaleArcsec, orientatDegrees: visit.orientatDegrees });
  }
  return samplings;
}

/** One frame's rows, in detector order, with the reflectance of the ones the body sits on. The frame is read once and let go
 * when the generator finishes, so a scan of any length holds one frame at a time. */
async function* frameRows(definition: SlitScanDefinition, directory: string, frame: PreparedFrame, visit: VisitRegistration, reference: ReferenceSpectrum) {
  const region = await readFrameRegion(resolve(directory, frame.name), frame, definition, frame.commandedRow);
  const reach = Math.ceil(frame.radiusArcsec / frame.plateScaleArcsec) + 2, wavelengths = Array.from(region.wavelengthAngstrom);
  for (let row = 0; row < region.height; row++) {
    if (Math.abs(row - visit.discRow) > reach) { yield { row, reflectance: null }; continue; }
    const flux: number[] = [], error: number[] = [];
    for (let x = 0; x < region.width; x++) { flux.push(region.flux[row * region.width + x]!); error.push(region.error[row * region.width + x]!); }
    yield { row, reflectance: reflectance({ wavelengthAngstrom: wavelengths, flux, error }, reference) };
  }
}

export interface FeaturelessSet { readonly spectrum: Reflectance; readonly rows: number; readonly onDiscRows: number }
/** The spectrum every row is measured against: the mean of the rows that show no band at all.
 *
 * The rule is the paper's own, and so is the reason for it. The published map fits a polynomial to each spectrum on its own,
 * which sets no common zero; where the paper needed a zero it wrote (Trumbo, Brown & Hand 2019): "we then divided by the
 * average of all spectra from regions where the 450-nm feature is absent". Which rows those are is decided here by a first
 * pass with the published continuum and nothing else: a row whose continuum-removed residual shows no absorption at all. */
export async function featurelessReference(definition: SlitScanDefinition, directory: string, frames: readonly PreparedFrame[],
  registration: readonly VisitRegistration[], reference: ReferenceSpectrum): Promise<FeaturelessSet> {
  const accumulator = newFeatureless();
  let onDiscRows = 0;
  for (const visit of registration) for (const frame of frames.filter(entry => entry.visit === visit.visit)) {
    for await (const row of frameRows(definition, directory, frame, visit, reference)) {
      if (!row.reflectance) continue;
      const strength = bandFromReflectance(row.reflectance, definition.band);
      if (!strength) continue;
      onDiscRows++;
      if (strength.equivalentWidthAngstrom <= 0) addFeatureless(accumulator, row.reflectance, frame.exposureSeconds);
    }
  }
  const spectrum = featurelessMean(accumulator);
  if (!spectrum) throw new Error('No row of this scan shows the band absent, so there is nothing to measure zero against.');
  return { spectrum, rows: accumulator.rows, onDiscRows };
}

/** One visit's scan placed on the body: its sky image, the camera the ephemeris and the pole model imply, and the projection. */
function placeVisit(definition: SlitScanDefinition, visit: VisitRegistration, sampling: ScanSampling, frame: PreparedFrame,
  orientation: BodyOrientation, direction: AcrossSlitDirection): VisitMap {
  const arcsecPerPixel = sampling.plateScaleArcsec;
  const half = Math.ceil(definition.reduction.imageHalfWidthRadii * visit.radiusArcsec / arcsecPerPixel);
  const image = scanImage(sampling, 2 * half + 1, arcsecPerPixel, direction);
  const camera = observerCamera({ epochJd: visit.midJulianDate,
    targetRightAscensionDegrees: frame.ephemeris.rightAscensionDegrees, targetDeclinationDegrees: frame.ephemeris.declinationDegrees,
    rangeAu: frame.ephemeris.rangeAu, sunRightAscensionDegrees: frame.ephemeris.sunRightAscensionDegrees, sunDeclinationDegrees: frame.ephemeris.sunDeclinationDegrees,
    pixelAngleMicroradians: arcsecPerPixel / ARCSEC_PER_RADIAN * 1e6, center: [half, half] }, orientation);
  const map = projectBandMap({ width: image.pixels, height: image.pixels, depth: image.depth, error: image.error, continuum: image.depth } as never,
    camera, definition.bodyRadiusKm, { width: definition.grid.width, height: definition.grid.height }, definition.grid.maximumEmissionDegrees);
  return { registration: visit, camera, map, sampled: image.filled };
}

const cellPlace = (definition: SlitScanDefinition, cell: number) => ({
  latitude: 90 - (Math.floor(cell / definition.grid.width) + 0.5) * 180 / definition.grid.height,
  westLongitude: 360 - (cell % definition.grid.width + 0.5) * 360 / definition.grid.width,
});
/** Where the band absorbs most, and how strongly. */
export function strongest(definition: SlitScanDefinition, depth: Float32Array) {
  let best = -Infinity, at = -1;
  for (let cell = 0; cell < depth.length; cell++) if (Number.isFinite(depth[cell]!) && depth[cell]! > best) { best = depth[cell]!; at = cell; }
  if (at < 0) throw new Error('The map kept no cell.');
  return { ...cellPlace(definition, at), value: best };
}

export interface SlitScanOptions { readonly directory: string; readonly mayAsk?: boolean; readonly verifyDigests?: boolean; readonly mirror?: boolean; readonly log?: (line: string) => void }

/** One run of the stage: the frames, where each visit sat, the map and, when asked for, the map the opposite across-slit
 * direction would have given, which is the evidence for the one adopted. */
export async function runSlitScan(definition: SlitScanDefinition, options: SlitScanOptions): Promise<SlitScanRun> {
  const log = options.log ?? (() => {});
  const frames = await prepareFrames(definition, options.directory, options.mayAsk ?? false, options.verifyDigests ?? true);
  const used = frames.filter(frame => !frame.rejected);
  log(`${used.length} of ${frames.length} frames used, ${frames.length - used.length} rejected`);
  const referencePath = resolve(options.directory, definition.reference.name);
  if (options.verifyDigests ?? true) {
    const digest = await sha256File(referencePath);
    if (digest.sha256 !== definition.reference.sha256) throw new Error(`${definition.reference.name} is not the pinned reference spectrum.`);
  }
  const reference = readReferenceSpectrum(await readFile(referencePath), definition);
  const registration = await registerVisits(definition, options.directory, used);
  for (const visit of registration) log(`${visit.visit} row ${visit.discRow.toFixed(2)}  across-slit centre ${visit.acrossSlitCentreArcsec.toFixed(3)}"  ` +
    `chord residual ${visit.chordRmsArcsec.toFixed(4)}" over ${visit.chordSteps} steps of radius ${visit.radiusArcsec.toFixed(3)}"`);
  const featureless = await featurelessReference(definition, options.directory, used, registration, reference);
  log(`${featureless.rows} of ${featureless.onDiscRows} on-disc rows show the band absent and make the spectrum zero is measured against`);
  const firstPassSamplings = await sampleVisits(definition, options.directory, used, registration, reference, null);
  const referenceSigmas: number[] = [];
  const samplings = await sampleVisits(definition, options.directory, used, registration, reference, featureless.spectrum, referenceSigmas);
  const orientation = await loadOrientation(REPOSITORY, definition.orientation as never, REPOSITORY);

  const place = (direction: AcrossSlitDirection, from = samplings) => registration.map(visit =>
    placeVisit(definition, visit, from.get(visit.visit)!, used.find(frame => frame.visit === visit.visit)!, orientation, direction));
  const visits = place(definition.acrossSlitDirection);
  const firstPass = combineBodyMaps(place(definition.acrossSlitDirection, firstPassSamplings).map(entry => entry.map), definition.grid.maximumEmissionDegrees);
  for (const entry of visits) log(`${entry.registration.visit} sub-observer ${entry.camera.observerWestLongitude.toFixed(1)}°W ${entry.camera.observerLatitude.toFixed(1)}°  ` +
    `${entry.map.seenCells} cells, ${(entry.map.areaShare * 100).toFixed(1)}% of the surface`);
  // The shipped map goes through the policy: the visits must be one measurement in one frame before they are averaged. The
  // first-pass and mirrored maps above and below are diagnostics of the placement and use the averaging primitive directly.
  const frame = scanFrame(definition, digestOf(await readFile(resolve(REPOSITORY, definition.orientation.path)))), measurement = scanMeasurement(definition, definition.acrossSlitDirection);
  const { map: combinedMap, overlaps: combinedOverlaps } = combineUnderPolicy(visits.map(entry => ({ map: entry.map, definition: measurement, frame,
    observation: (() => { const frame_ = used.find(frame__ => frame__.visit === entry.registration.visit)!;
      return scanObservation(definition, entry, frame_.plateScaleArcsec, frame_.programme); })() })), SCAN_COMBINATION, definition.grid.maximumEmissionDegrees);
  const combined = { map: combinedMap, overlaps: combinedOverlaps };
  const coverage = new Float32Array(definition.grid.width * definition.grid.height);
  for (const entry of visits) for (let cell = 0; cell < coverage.length; cell++) if (Number.isFinite(entry.map.depth[cell]!)) coverage[cell]! += 1;

  let mirrored: SlitScanRun['mirrored'];
  if (options.mirror) {
    const other = ACROSS_SLIT_DIRECTIONS.find(entry => entry !== definition.acrossSlitDirection)!;
    const maps = place(other), result = combineBodyMaps(maps.map(entry => entry.map), definition.grid.maximumEmissionDegrees);
    mirrored = { direction: other, overlaps: result.overlaps, peak: strongest(definition, result.map.depth) };
  }
  return { definition, frames, used, registration, direction: definition.acrossSlitDirection, visits, combined, coverage, featureless, firstPass, referenceSigmas,
    ...mirrored ? { mirrored } : {} };
}

// ---- products ---------------------------------------------------------------------------------------------------------
/** The map as FITS: the band strength, its error and how many visits saw each cell, on a full-world longitude-latitude grid in
 * the layout the scalar-map reader reads, NaN where the body was not seen. */
export function scanProduct(definition: SlitScanDefinition, run: SlitScanRun): Buffer {
  const map = run.combined.map;
  return bodyMapFits(map, {
    TELESCOP: 'HST', INSTRUME: definition.instrument, OPT_ELEM: definition.opticalElement, APERTURE: definition.aperture,
    OBJECT: definition.target, QUANTITY: definition.band.quantity, BANDID: definition.band.id,
    BANDLO: String(definition.band.bandAngstrom[0]), BANDHI: String(definition.band.bandAngstrom[1]),
    CONTORD: String(definition.band.continuumOrder), ACROSSLT: definition.acrossSlitDirection,
    NVISITS: String(run.visits.length), NFRAMES: String(run.used.length), SCANID: definition.id,
    COMMONER: String(quantiles(run.referenceSigmas, [0.5])[0] ?? 0),
    ORIGIN: 'cssEarth tools/objects/hst/slit-scan-map.mts',
  }, [
    { name: definition.band.quantity, units: definition.band.units, values: map.depth },
    { name: `${definition.band.quantity} ERROR`, units: definition.band.units, values: map.error },
    { name: 'COVERAGE', units: 'visits', values: run.coverage },
  ]);
}

const round = (value: number, digits = 3) => +value.toFixed(digits);

/** What a set of visit-to-visit overlaps says about an across-slit direction: how many pairs disagree in sign at all, and how
 * far apart the two measurements of one cell sit, over every shared cell. A direction that is wrong reflects each visit's
 * picture about its own slit, so the ground moves under it and the pairs stop agreeing. */
export function overlapAgreement(overlaps: ReturnType<typeof combineBodyMaps>['overlaps']) {
  const cells = overlaps.reduce((total, pair) => total + pair.cells, 0);
  return { pairs: overlaps.length, negativePairs: overlaps.filter(pair => pair.correlation < 0).length,
    cells, rmsDifference: round(Math.sqrt(overlaps.reduce((total, pair) => total + pair.cells * pair.rmsDifference ** 2, 0) / (cells || 1)), 2),
    meanCorrelation: round(overlaps.reduce((total, pair) => total + pair.cells * pair.correlation, 0) / (cells || 1)) };
}

/** The receipt: what was scanned, where each visit sat, what the map measures, what the published account says beside it, and
 * what is not verified. */
export function scanReceipt(run: SlitScanRun) {
  const definition = run.definition, map = run.combined.map, kept = [...map.depth].filter(Number.isFinite);
  const [minimum, lowQuartile, median, highQuartile, maximum] = quantiles(kept, [0, 0.25, 0.5, 0.75, 1]);
  const peak = strongest(definition, map.depth);
  /** A band of longitudes within 45 degrees of the equator: its median band strength, and the error on that median, which is
   * the scatter of the cells divided by the root of how many of them there are. */
  const cellSteradian = (180 / definition.grid.height) * (360 / definition.grid.width) * DEGREE * DEGREE;
  const elementArea = definition.grid.resolutionKm ** 2;
  const hemisphere = (depth: Float32Array, error: Float32Array, from: number, to: number) => {
    const values: number[] = [], errors: number[] = [];
    let areaKm2 = 0;
    for (let cell = 0; cell < depth.length; cell++) {
      if (!Number.isFinite(depth[cell]!)) continue;
      const place = cellPlace(definition, cell);
      if (Math.abs(place.latitude) > 45) continue;
      const west = place.westLongitude;
      if (from < to ? west >= from && west < to : west >= from || west < to) {
        values.push(depth[cell]!); errors.push(error[cell]!);
        areaKm2 += cellSteradian * Math.cos(place.latitude * DEGREE) * definition.bodyRadiusKm ** 2;
      }
    }
    const [low, middle, high] = quantiles(values, [0.25, 0.5, 0.75]);
    // Neighbouring cells are not independent: one resolution element covers many of them, so a median over the cells is only
    // as well determined as the number of resolution elements the patch holds. The element is taken at its best, the
    // sub-observer point, which counts the most elements and so gives the smallest error this can honestly claim.
    const elements = Math.max(1, areaKm2 / elementArea), spread = (high! - low!) / 1.349;
    return { cells: values.length, areaKm2: round(areaKm2, 0), resolutionElements: round(elements, 0),
      median: round(middle!, 2), interquartile: round(high! - low!, 2),
      medianError: round(1.2533 * spread / Math.sqrt(elements), 2),
      medianStatisticalError: round(quantiles(errors, [0.5])[0]!, 2) };
  };
  const hemispheres = (from: ReturnType<typeof combineBodyMaps>) => ({
    leading: hemisphere(from.map.depth, from.map.error, 0, 180), trailing: hemisphere(from.map.depth, from.map.error, 180, 360) });
  return {
    schema: 'cssearth-hst-slit-scan-map-reproduction@1',
    scan: definition.id, definition: `tools/objects/hst/programs/${definition.id}.scan.json`,
    target: definition.target, instrument: definition.instrument, opticalElement: definition.opticalElement, aperture: definition.aperture,
    band: { id: definition.band.id, quantity: definition.band.quantity, units: definition.band.units,
      bandAngstrom: definition.band.bandAngstrom, continuumWindowsAngstrom: definition.band.continuumWindowsAngstrom, continuumOrder: definition.band.continuumOrder,
      minimumBandCoverage: definition.band.minimumBandCoverage, maximumBandGapPixels: definition.band.maximumBandGapPixels,
      reference: { name: definition.reference.name, url: definition.reference.url, sha256: definition.reference.sha256, note: definition.reference.note } },
    frames: { pinned: definition.frames.length, used: run.used.length, visits: run.registration.length,
      exposureSeconds: run.used.reduce((total, frame) => total + frame.exposureSeconds, 0),
      rejected: [...new Set(run.frames.filter(frame => frame.rejected).map(frame => frame.rejected))].map(reason =>
        ({ reason, frames: run.frames.filter(frame => frame.rejected === reason).length })) },
    registration: run.visits.map(entry => ({ visit: entry.registration.visit, targetName: entry.registration.targetName, frames: entry.registration.frames,
      discRow: round(entry.registration.discRow, 2), acrossSlitCentreArcsec: round(entry.registration.acrossSlitCentreArcsec, 4),
      chordResidualArcsec: round(entry.registration.chordRmsArcsec, 4), chordSteps: entry.registration.chordSteps,
      radiusArcsec: round(entry.registration.radiusArcsec, 4), orientatDegrees: round(entry.registration.orientatDegrees, 3),
      subObserverWestLongitude: round(entry.camera.observerWestLongitude, 2), subObserverLatitude: round(entry.camera.observerLatitude, 2),
      northAzimuthDegrees: round(entry.camera.northAzimuthDegrees, 2), sampledPixels: entry.sampled,
      cells: entry.map.seenCells, areaShare: round(entry.map.areaShare, 4),
      bandStrengthMedian: round(quantiles([...entry.map.depth].filter(Number.isFinite), [0.5])[0]!, 2) })),
    acrossSlitDirection: {
      adopted: run.direction,
      /** Two visits that saw the same ground from different sub-observer points agree only when the across-slit direction is
       * the right one; the wrong one reflects each visit's picture about its own slit and moves the ground under it. */
      adoptedAgreement: overlapAgreement(run.combined.overlaps),
      adoptedOverlaps: run.combined.overlaps.map(pair => ({ first: run.visits[pair.first]!.registration.visit, second: run.visits[pair.second]!.registration.visit,
        cells: pair.cells, correlation: round(pair.correlation), rmsDifference: round(pair.rmsDifference, 2) })),
      mirrored: run.mirrored ? { direction: run.mirrored.direction, agreement: overlapAgreement(run.mirrored.overlaps),
        overlaps: run.mirrored.overlaps.map(pair => ({ first: run.visits[pair.first]!.registration.visit, second: run.visits[pair.second]!.registration.visit,
          cells: pair.cells, correlation: round(pair.correlation), rmsDifference: round(pair.rmsDifference, 2) })),
        strongest: { westLongitude: round(run.mirrored.peak.westLongitude, 1), latitude: round(run.mirrored.peak.latitude, 1), value: round(run.mirrored.peak.value, 2) } } : null,
    },
    map: { grid: [definition.grid.width, definition.grid.height], maximumEmissionDegrees: definition.grid.maximumEmissionDegrees,
      cells: map.seenCells, areaShare: round(map.areaShare, 4),
      cellsSeenByOneVisit: [...run.coverage].filter(count => count === 1).length, cellsSeenByTwoOrMore: [...run.coverage].filter(count => count >= 2).length,
      bandStrength: { minimum: round(minimum!, 2), lowQuartile: round(lowQuartile!, 2), median: round(median!, 2), highQuartile: round(highQuartile!, 2), maximum: round(maximum!, 2) },
      /** The median of the ERROR plane: each cell's band pixels' own noise and the anchors' noise carried through the one
       * continuum they share. It is a statistical error, and says nothing about the continuum model's own systematic. */
      medianErrorAngstrom: round(quantiles([...map.error].filter(Number.isFinite), [0.5])[0]!, 2),
      /** How much of that one sigma came from the spectrum every row was divided by. Every cell carries the same draw of it,
       * so it does not average down: a median over the whole map is no better determined than this. */
      referenceError: (() => {
        const [low, median, high] = quantiles(run.referenceSigmas, [0.25, 0.5, 0.75]);
        return { rows: run.referenceSigmas.length, lowQuartile: round(low!, 2), median: round(median!, 2), highQuartile: round(high!, 2),
          commonToEveryCell: true, averagesDownOverTheMap: false };
      })(),
      strongest: { westLongitude: round(peak.westLongitude, 1), latitude: round(peak.latitude, 1), value: round(peak.value, 2) },
      hemispheres: hemispheres(run.combined) },
    /** The test of the zero: where the published account says there is no band, the median should sit within its own error of
     * nothing. It is reported, never forced: the featureless set is chosen by each row's own spectrum, not by where it is. */
    zeroTest: (() => {
      const trailing = hemispheres(run.combined).trailing, before = hemispheres(run.firstPass).trailing;
      const consistent = (entry: { median: number; medianError: number }) => Math.abs(entry.median) <= 2 * entry.medianError;
      const leading = hemispheres(run.combined).leading;
      return { where: 'the trailing hemisphere, within 45 degrees of the equator',
        why: 'Trumbo, Brown & Hand (2019): the feature is located exclusively on the leading hemisphere.',
        publishedContinuumAlone: { median: before.median, medianError: before.medianError, consistentWithZero: consistent(before) },
        againstTheFeaturelessSpectrum: { median: trailing.median, medianError: trailing.medianError, consistentWithZero: consistent(trailing) },
        /** How much of the leading hemisphere's strength is a step across the whole hemisphere rather than the concentration
         * the published account describes. This stage does not separate the two. */
        leadingHemispherePedestal: leading.median,
        strongestAboveItsHemisphere: round(peak.value - leading.median, 2) };
    })(),
    /** Where zero is, and how it got there. The published continuum is fitted to each spectrum on its own and sets no common
     * zero; what it gives is kept here beside what the ratio against the featureless spectrum gives. */
    zeroPoint: {
      rule: definition.band.featurelessReference.rule, note: definition.band.featurelessReference.note,
      rowsShowingNoBand: run.featureless.rows, onDiscRows: run.featureless.onDiscRows,
      share: round(run.featureless.rows / run.featureless.onDiscRows, 3),
      /** The featureless set averages to zero by construction, so the trailing hemisphere is only a test in so far as the set
       * was chosen by each row's own spectrum and not by where it is on the body. */
      selectionIsSpectral: true,
      publishedContinuumAlone: { hemispheres: hemispheres(run.firstPass),
        strongest: (() => { const first = strongest(definition, run.firstPass.map.depth);
          return { westLongitude: round(first.westLongitude, 1), latitude: round(first.latitude, 1), value: round(first.value, 2) }; })(),
        overlaps: overlapAgreement(run.firstPass.overlaps) },
    },
    published: definition.published,
    method: definition.notes.method, measured: definition.notes.measured, notVerified: definition.notes.notVerified,
  };
}

/** A band strength is the ground's own, so visits on different dates are one measurement and a cell is their weighted mean. */
export const SCAN_COMBINATION: CombinationPolicy = { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } };

export const scanMeasurement = (definition: SlitScanDefinition, direction: AcrossSlitDirection): MeasurementDefinition => ({ quantity: definition.band.quantity, units: definition.band.units, timeDependence: 'surface-property',
  wavelengthIntervalsMicrometres: [[definition.band.bandAngstrom[0] / 10_000, definition.band.bandAngstrom[1] / 10_000]],
  source: definition.published[0]?.source ?? definition.reference.note,
  method: { kind: 'equivalent-width', bandAngstrom: definition.band.bandAngstrom, continuum: { model: 'polynomial', order: definition.band.continuumOrder, windowsAngstrom: definition.band.continuumWindowsAngstrom },
    solarReference: { name: definition.reference.name, sha256: definition.reference.sha256 }, reduction: definition.reduction, acrossSlitDirection: direction } });

export const scanFrame = (definition: SlitScanDefinition, rotationSha256: string): BodyMapFrame =>
  ({ body: definition.target.toLowerCase(), radiusKm: definition.bodyRadiusKm, rotation: { model: definition.orientation.path, sha256: rotationSha256, bodyCode: definition.orientation.body } });

/** Across the scan one resolution element is the slit's width; along the slit it is two detector pixels. Hubble's own blur is
 * not removed and is not counted here. */
export function scanObservation(definition: SlitScanDefinition, entry: VisitMap, plateScaleArcsec: number, programme: string): BodyMapObservation {
  const slitWidthArcsec = Number(/X([0-9.]+)/u.exec(definition.aperture)?.[1]), alongArcsec = 2 * plateScaleArcsec, west = (degrees: number) => ((degrees % 360) + 360) % 360;
  if (!(slitWidthArcsec > 0)) throw new TypeError(`The aperture ${definition.aperture} does not state a slit width.`);
  return { id: entry.registration.visit, telescope: 'HST', instrument: `${definition.instrument} ${definition.opticalElement} ${definition.aperture}`,
    mode: definition.instrument, programme: `${definition.target.toLowerCase()}-${programme}`, midTimeJd: entry.registration.midJulianDate, rangeKm: entry.camera.rangeKm,
    subObserver: { latitudeDegrees: entry.camera.observerLatitude, westLongitudeDegrees: west(entry.camera.observerWestLongitude) }, subSolar: { latitudeDegrees: entry.camera.sunLatitude, westLongitudeDegrees: west(entry.camera.sunWestLongitude) },
    angularResolution: { majorArcsec: Math.max(slitWidthArcsec, alongArcsec), minorArcsec: Math.min(slitWidthArcsec, alongArcsec), evidence: { kind: 'sampling' }, basis: 'slit width across the scan and two detector pixels along the slit; the telescope blur is not removed' } };
}

/** What the map means, to be written beside it: the band, the continuum and the reference that define the number, the frame,
 * and every visit that went in. */
export function scanBodyMapRecord(definition: SlitScanDefinition, run: SlitScanRun, fits: Buffer, fileName: string, rotationSha256: string): BodyMapProduct {
  const observations = run.visits.map(entry => { const frame = run.used.find(frame_ => frame_.visit === entry.registration.visit)!;
    return scanObservation(definition, entry, frame.plateScaleArcsec, frame.programme); });
  return { schema: 'cssearth-body-map@1', definition: scanMeasurement(definition, run.direction), frame: scanFrame(definition, rotationSha256),
    grid: { width: run.combined.map.width, height: run.combined.map.height, longitude: 'east-positive-from-0', rows: 'north-to-south' },
    planes: { file: fileName, sha256: digestOf(fits), value: definition.band.quantity, uncertainty: `${definition.band.quantity} ERROR` }, mask: { maximumEmissionDegrees: definition.grid.maximumEmissionDegrees, missing: 'NaN' }, observations,
    ...(observations.length > 1 ? { combination: SCAN_COMBINATION } : {}) };
}

export async function writeProducts(definition: SlitScanDefinition, run: SlitScanRun, outputDirectory: string) {
  await mkdir(outputDirectory, { recursive: true });
  const name = `${definition.band.id}.fits`;
  const fits = scanProduct(definition, run), rotationBytes = await readFile(resolve(REPOSITORY, definition.orientation.path));
  const product = scanBodyMapRecord(definition, run, fits, name, digestOf(rotationBytes)), metadata = Buffer.from(formatBodyMapProduct(product));
  const registration = Buffer.from(`${JSON.stringify({ scan: definition.id, acrossSlitDirection: run.direction,
    frames: run.frames.map(frame => ({ name: frame.name, visit: frame.visit, programme: frame.programme, targetName: frame.targetName,
      postArg1Arcsec: frame.postArg1Arcsec, postArg2Arcsec: frame.postArg2Arcsec, orientatDegrees: frame.orientatDegrees,
      angularDiameterArcsec: frame.ephemeris.angularDiameterArcsec, rejected: frame.rejected })),
    visits: run.visits.map(entry => ({ ...entry.registration, camera: entry.camera })) }, null, 1)}\n`);
  await writeFile(resolve(outputDirectory, name), fits);
  await writeFile(resolve(outputDirectory, `${name}.body-map.json`), metadata);
  await writeFile(resolve(outputDirectory, 'registration.json'), registration);
  const definitionBytes = await readFile(scanPath(definition.id)), responsesBytes = await readFile(resolve(PROGRAMS, definition.horizons.responses));
  const inputs: ProductInput[] = [{ role: 'slit-scan definition', identity: `tools/objects/hst/programs/${definition.id}.scan.json`, bytes: definitionBytes.byteLength, sha256: digestOf(definitionBytes) },
    ...definition.frames.map(frame => ({ role: frame.rejected ? 'rejected archive frame' : 'archive rectified frame', identity: frame.uri, bytes: frame.bytes, sha256: frame.sha256 })),
    { role: 'solar reference', identity: definition.reference.url, bytes: definition.reference.bytes, sha256: definition.reference.sha256 },
    { role: 'Horizons responses', identity: `tools/objects/hst/programs/${definition.horizons.responses}`, bytes: responsesBytes.byteLength, sha256: digestOf(responsesBytes) },
    { role: 'rotation model', identity: definition.orientation.path, bytes: rotationBytes.byteLength, sha256: digestOf(rotationBytes) }];
  const software: ProductSoftware[] = [{ name: 'cssEarth slit-scan-map', version: '1' }, { name: 'node', version: process.versions.node }];
  const record = bodyMapProductRecord(product, fits, metadata, inputs, software, undefined, [{ path: 'registration.json', bytes: registration }]);
  await writeFile(resolve(outputDirectory, `${name}.product.json`), formatProductRecord(record));
  return [name, `${name}.body-map.json`, `${name}.product.json`, 'registration.json'];
}

// ---- the stage --------------------------------------------------------------------------------------------------------
export const scanPath = (id: string) => resolve(PROGRAMS, `${id}.scan.json`);
export const readSlitScan = async (id: string) => parseSlitScan(JSON.parse(await readFile(scanPath(id), 'utf8')));

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), flags = args.filter(argument => argument.startsWith('--')), rest = args.filter(argument => !argument.startsWith('--'));
  const [id, directory, output] = rest;
  if (!id || !directory || !output) {
    console.error('usage: slit-scan-map.mts <scan id> <frames directory> <output directory> [--fetch] [--receipt] [--mirror] [--no-verify]');
    process.exit(2);
  }
  const unknown = flags.filter(flag => !['--fetch', '--receipt', '--mirror', '--no-verify'].includes(flag));
  if (unknown.length) { console.error(`unknown option ${unknown.join(' ')}`); process.exit(2); }
  const definition = await readSlitScan(id);
  const run = await runSlitScan(definition, { directory, mayAsk: flags.includes('--fetch'), verifyDigests: !flags.includes('--no-verify'),
    mirror: flags.includes('--mirror'), log: line => console.log(line) });
  const written = await writeProducts(definition, run, output);
  const receipt = scanReceipt(run);
  console.log(`map ${receipt.map.cells} cells, ${(receipt.map.areaShare * 100).toFixed(1)}% of the surface; band strength median ` +
    `${receipt.map.bandStrength.median} ${definition.band.units}, strongest ${receipt.map.strongest.value} at ` +
    `${receipt.map.strongest.westLongitude}°W ${receipt.map.strongest.latitude}°`);
  console.log(`wrote ${written.join(', ')} to ${output}`);
  if (flags.includes('--receipt')) {
    const path = resolve(PROGRAMS, `${definition.id}.scan.reproduction.json`);
    await writeFile(path, `${JSON.stringify(receipt, null, 1)}\n`);
    console.log(`wrote ${path}`);
  }
}
