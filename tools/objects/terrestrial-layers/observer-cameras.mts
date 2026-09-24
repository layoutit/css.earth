/**
 * The observer-camera derivation a body records beside its recipe, so every camera field a ground-based photograph
 * lens states is reproducible from pinned inputs: the rotation model, the pinned Horizons tables, each frame's own
 * header, and the lens mesh. `source/preparation/observer-cameras.json` names those inputs; the derivation reads
 * them and returns the controlled-camera fields the recipe must state. The command in `tools/objects/observer-cameras.mts`
 * writes them, and the shared test refuses a recipe that drifts from its own inputs.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString, array, number, optional, shape, text } from '@cssearth/core';
import { decodeProfile } from './source-records.mts';
import { readFitsHdu } from '@cssearth/fits';
import { parseTextKernel } from '../../spice/text-kernel.mts';
import { parseLeapSeconds } from '../../spice/lsk.mts';
import { restoredBankFile } from '../../spice/kernel-bank.mts';
import { decodeCalibratedCamera } from './shape-camera-mosaic.mts';
import { observerCamera, parseSpinState, pckOrientation, spinOrientation, type BodyOrientation, type ObserverCamera, type ObserverSighting } from './observer-camera.mts';
import { limbCentre } from './registration-sweeps.mts';
import { readingPole, spinRecordReading } from './spin-record-reading.mts';

const DEGREE = Math.PI / 180;
export const OBSERVER_CAMERAS_SCHEMA = 'cssearth-observer-cameras@1';
export const OBSERVER_CAMERAS_FILE = 'preparation/observer-cameras.json';
/** The shared leap-second kernel every IAU pole model is evaluated with. */
export const LEAP_SECONDS_KERNEL = 'src/spice/cassini/lsk/naif0012.tls';
/** The leap-seconds kernel's local path, restored from the Cassini bank when missing. */
export const leapSecondsKernel = (repositoryRoot: string) => restoredBankFile(resolve(repositoryRoot, LEAP_SECONDS_KERNEL));
/** A frame's limb-fitted centre is stated only when the fit settled: enough limb, and a last step under half a pixel. */
export const SETTLED_LIMB = { minimumBins: 8, maximumLastMovePixels: 0.5 } as const;
export const limbSettled = (limb: { limbBins: number; movedPixels: number }) => limb.limbBins >= SETTLED_LIMB.minimumBins && limb.movedPixels < SETTLED_LIMB.maximumLastMovePixels;

/**
 * A spin record's column order is established against a published pole: the body's own, `reference/model-properties.json`,
 * or, when that belongs to another solution (a DAMIT model beside a survey lens, say), the one the rotation states with
 * the publication and table it comes from.
 */
const parsePublishedPole = shape({ source: text, table: text, eclipticJ2000Degrees: array(number) });
const parseRotation = shape({ kind: text, path: text, columnOrder: optional(text), body: optional(number), publishedPole: optional(parsePublishedPole) });
/**
 * The published comparison a ground-based lens ships on. The survey papers register a model by fitting shape, spin and a
 * per-image offset together and show the fit as a figure per epoch; they state no independent check. A lens whose cameras
 * reproduce that figure names the included ledger entry that decides it; the figure itself, the measurements and their
 * image are owned by `preparation/published-comparison.json` and `evidence/published-comparison.json`, which
 * `tools/objects/published-comparison.mts` writes. Its registration verdict is then reported beside the lens, not a gate.
 */
const parseComparison = shape({ ledgerEntry: text });
const parseRecord = shape({ schema: text, lensId: text, rotation: parseRotation, ephemeris: shape({ observer: text, heliocentric: text }), epoch: text,
  centre: shape({ method: text, edgeFraction: number }), publishedComparison: optional(parseComparison) });
export type ObserverCamerasRecord = ReturnType<typeof parseRecord>;

/** The derivation record, validated: one lens, one rotation model, two Horizons tables, the epoch and centre rules. */
export function parseObserverCameras(value: unknown): ObserverCamerasRecord {
  const record = decodeProfile(parseRecord, value, 'Invalid observer-cameras record.');
  if (record.schema !== OBSERVER_CAMERAS_SCHEMA) throw new TypeError(`Invalid observer-cameras record: schema ${record.schema}.`);
  const { rotation } = record;
  if (rotation.kind === 'spin-record') {
    if (rotation.columnOrder !== 'latitude-first' && rotation.columnOrder !== 'longitude-first') throw new TypeError('A spin record states its column order, latitude-first or longitude-first, established against a published pole.');
    if (rotation.body !== undefined) throw new TypeError('A spin record names no body code.');
    const pole = rotation.publishedPole?.eclipticJ2000Degrees;
    if (pole && (pole.length !== 2 || !(Math.abs(pole[1]) <= 90))) throw new TypeError('A stated published pole is an ecliptic longitude and a latitude within 90 degrees.');
  } else if (rotation.kind === 'iau-pck') {
    if (!Number.isInteger(rotation.body) || rotation.columnOrder !== undefined || rotation.publishedPole !== undefined) throw new TypeError('An IAU pole model names its NAIF body code and no column order.');
  } else throw new TypeError(`Unknown rotation model kind ${rotation.kind}.`);
  if (record.epoch !== 'exposure-midpoint') throw new TypeError('The exposure epoch rule is exposure-midpoint.');
  if (record.centre.method !== 'limb' || !(record.centre.edgeFraction > 0 && record.centre.edgeFraction < 1)) throw new TypeError('The centre rule is the limb at a stated fraction of the peak.');
  const comparison = record.publishedComparison;
  if (comparison !== undefined) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(comparison.ledgerEntry)) throw new TypeError('A published comparison names the ledger entry that decides it.');
    const extra = Object.keys(comparison as Record<string, unknown>).filter(key => key !== 'ledgerEntry');
    if (extra.length) throw new TypeError(`A published comparison names only its ledger entry; ${extra.join(', ')} belong to preparation/published-comparison.json.`);
  }
  return record;
}

/** The orientation the record names, read from the pinned file. */
export async function loadOrientation(sourceDirectory: string, rotation: ObserverCamerasRecord['rotation'], repositoryRoot: string): Promise<BodyOrientation> {
  const source = await readFile(await restoredBankFile(resolve(sourceDirectory, rotation.path)), 'utf8');
  if (rotation.kind === 'spin-record') {
    // The stated column order must be the one the published pole supports; nothing in the record says which it is.
    const pole = await readingPole(sourceDirectory, rotation.publishedPole);
    if (pole) {
      const reading = spinRecordReading(source, pole);
      if (reading.order !== rotation.columnOrder) throw new TypeError(`${rotation.path} is stated ${rotation.columnOrder}, but the published pole reads it ${reading.order} (${reading.separationDegrees.toFixed(1)}° against ${reading.otherSeparationDegrees?.toFixed(1) ?? 'no other reading'}).`);
    }
    return spinOrientation(parseSpinState(source, rotation.columnOrder as 'latitude-first' | 'longitude-first'));
  }
  const pool = parseTextKernel(source, rotation.path);
  const leapSeconds = parseLeapSeconds(parseTextKernel(await readFile(await leapSecondsKernel(repositoryRoot), 'utf8'), 'naif0012.tls'));
  return pckOrientation(pool, requireFiniteNumber(rotation.body, 'body code'), leapSeconds);
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const utcJd = (year: number, month: number, day: number, hour: number, minute: number, second: number) =>
  Date.UTC(year, month, day, hour, minute, 0) / 86_400_000 + 2440587.5 + second / 86_400;

/** The rows of a pinned Horizons table between its own start and end markers. */
export function horizonsRows(text: string) {
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error('Pinned Horizons response has no data block.');
  return text.slice(start, end).split('\n').slice(1).map(line => line.trimEnd()).filter(line => line.trim().length > 0);
}
const numbers = (line: string) => (line.match(/-?\d+\.\d+(?:E[+-]\d+)?/g) ?? []).map(Number);
/** Where the sky puts the body and how far it is, in degrees and astronomical units, from one observer-table row. The date and the optional presence markers come first. */
export function observerRowValues(line: string) {
  const [rightAscension, declination, , rangeAu] = numbers(line.slice(25).replace(/^\s*[a-zA-Z*]{1,2}\s+/, ' '));
  return { rightAscension, declination, rangeAu };
}
/** The Julian date a Horizons row states in its calendar column. */
export function rowJd(line: string) {
  const match = line.match(/(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) throw new Error(`Horizons row states no calendar date: ${line.trim()}`);
  return utcJd(Number(match[1]), MONTHS[match[2]], Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
}

/** A ZIMPOL frame's own statement of when and how it was exposed. */
export interface ZimpolExposure { start: string; startJd: number; exposureSeconds: number; filter: string; pixelAngleMicroradians: number }
export function zimpolExposure(header: Record<string, unknown>): ZimpolExposure {
  const stated = (key: string) => String(header[key] ?? '').replace(/^'|'$/g, '').trim();
  const start = stated('DATE-OBS'), match = start.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) throw new Error(`The frame states no usable exposure start: ${start || '(none)'}`);
  const exposureSeconds = Number(stated('ESO DET SEQ1 EXPTIME')), filter = stated('ESO INS3 OPTI5 NAME');
  const scale = Math.abs(Number(stated('CD1_1')));
  if (!(exposureSeconds > 0) || !(exposureSeconds < 3600)) throw new Error('The frame states no usable exposure time.');
  if (!filter) throw new Error('The frame states no filter.');
  if (!(scale > 0)) throw new Error('The frame states no plate scale.');
  const [, year, month, day, hour, minute, second] = match;
  return { start, startJd: utcJd(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)), exposureSeconds, filter, pixelAngleMicroradians: scale * DEGREE * 1e6 };
}

export interface DerivedCamera extends ObserverCamera { id: string; path: string; exposure: ZimpolExposure; sighting: ObserverSighting; limb: { iterations: number; movedPixels: number; limbBins: number; residualPixels: number } }

/**
 * Every controlled-camera field for the lens's frames. The epoch is the exposure midpoint; the geometry is the pinned
 * Horizons row at the exposure start, matched by its calendar date; the Sun direction is the negated heliocentric
 * position; the disc centre is the limb fit against the lens mesh.
 */
export async function deriveObserverCameras(sourceDirectory: string, record: ObserverCamerasRecord, frames: readonly { id: string; path: string }[],
    mesh: { positions: readonly (readonly number[])[] }, repositoryRoot: string, { orientation: given }: { orientation?: BodyOrientation } = {}): Promise<DerivedCamera[]> {
  // A caller measuring the record, such as a phase sweep, passes the orientation it wants judged; the recipe's cameras always use the record's own.
  const orientation = given ?? await loadOrientation(sourceDirectory, record.rotation, repositoryRoot);
  const observer = horizonsRows(await readFile(resolve(sourceDirectory, record.ephemeris.observer), 'utf8'));
  const heliocentric = horizonsRows(await readFile(resolve(sourceDirectory, record.ephemeris.heliocentric), 'utf8')).filter(line => line.trimStart().startsWith('X ='));
  const vectorRows = horizonsRows(await readFile(resolve(sourceDirectory, record.ephemeris.heliocentric), 'utf8')).filter(line => /^\s*\d{7}\.\d+ = A\.D\./.test(line));
  if (heliocentric.length !== observer.length || vectorRows.length !== observer.length) throw new Error('The pinned Horizons tables do not cover the same epochs.');
  const derived: DerivedCamera[] = [];
  for (const frame of frames) {
    const bytes = await readFile(resolve(sourceDirectory, frame.path)), { header } = readFitsHdu(bytes), exposure = zimpolExposure(header);
    const row = observer.findIndex(line => Math.abs(rowJd(line) - exposure.startJd) < 2 / 86_400);
    if (row < 0) throw new Error(`No pinned Horizons row at the exposure start of ${frame.id} (${exposure.start}).`);
    const { rightAscension, declination, rangeAu } = observerRowValues(observer[row]);
    const [sunX, sunY, sunZ] = numbers(heliocentric[row]), magnitude = Math.hypot(sunX, sunY, sunZ);
    if (![rightAscension, declination, rangeAu, magnitude].every(Number.isFinite) || !(rangeAu > 0) || !(magnitude > 0)) throw new Error(`Unreadable Horizons rows for ${frame.id}.`);
    const sighting = { epochJd: exposure.startJd + exposure.exposureSeconds / 2 / 86_400, targetRightAscensionDegrees: rightAscension, targetDeclinationDegrees: declination, rangeAu,
      sunRightAscensionDegrees: ((Math.atan2(-sunY, -sunX) / DEGREE) + 360) % 360, sunDeclinationDegrees: Math.asin(-sunZ / magnitude) / DEGREE, pixelAngleMicroradians: exposure.pixelAngleMicroradians };
    const image = decodeCalibratedCamera(bytes, 'fits-zimpol-intensity');
    const limb = limbCentre(image, sighting, orientation, mesh.positions, { edgeFraction: record.centre.edgeFraction });
    const camera = observerCamera({ ...sighting, center: limb.center }, orientation);
    derived.push({ ...camera, id: frame.id, path: frame.path, exposure, sighting: { ...sighting, center: limb.center }, limb: { iterations: limb.iterations, movedPixels: limb.movedPixels, limbBins: limb.limbBins, residualPixels: limb.residualPixels } });
  }
  return derived;
}

/** The camera fields as the recipe states them: rounded once, here, so the recipe and the derivation agree to the digit. */
export function recipeFields(camera: ObserverCamera) {
  const round = (value: number, digits: number) => Number(value.toFixed(digits));
  return { observerLatitude: round(camera.observerLatitude, 4), observerWestLongitude: round(camera.observerWestLongitude, 4), sunLatitude: round(camera.sunLatitude, 4),
    sunWestLongitude: round(camera.sunWestLongitude, 4), rangeKm: round(camera.rangeKm, 1), northAzimuthDegrees: round(camera.northAzimuthDegrees, 4),
    pixelAngleMicroradians: round(camera.pixelAngleMicroradians, 6), center: [round(camera.center[0], 3), round(camera.center[1], 3)] as [number, number] };
}

/** The lens recipe's frames and the record, from an object's source directory. */
export async function loadObserverCameraInputs(sourceDirectory: string) {
  const record = parseObserverCameras(JSON.parse(await readFile(resolve(sourceDirectory, OBSERVER_CAMERAS_FILE), 'utf8')));
  const recipe = requireRecord(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8')));
  const lenses = requireRecord(recipe.raster).surfaceObservations;
  const lens = Array.isArray(lenses) ? lenses.map(value => requireRecord(value)).find(entry => entry.id === record.lensId) : undefined;
  if (!lens || !Array.isArray(lens.frames)) throw new Error(`The recipe states no lens ${record.lensId} with frames.`);
  const frames = lens.frames.map(value => requireRecord(value)).map(frame => ({ id: requireString(frame.id), path: requireString(frame.path), stated: frame }));
  return { record, recipe, lens, frames };
}
