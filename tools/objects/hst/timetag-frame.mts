#!/usr/bin/env node
/** Rebuild one STIS TIME-TAG exposure in a moving target's own rest frame.
 *
 *   node tools/objects/hst/timetag-frame.mts <definition id> <files directory> <output directory> [--fetch] [--receipt]
 *
 * A MAMA detector in TIME-TAG mode records a position and a time for every photon. When the telescope follows a body that
 * moves, and a drift is commanded on top of that to spread detector blemishes out, the body wanders across the detector and
 * the summed image smears it. This stage follows the body through the exposure and counts the events again on a grid fixed
 * to the body: north up, east left, a stated number of kilometres to the pixel. No pixel is resampled, because nothing is
 * interpolated: an event is counted where the body was when it arrived.
 *
 * Nothing about one body or one claim is written here. Which file, which target, which grid, how the body is followed and
 * which region a published claim is about all come from a pinned definition in `programs/`, beside the raw JPL Horizons
 * response that places the target; a re-run asks the network for nothing. The first one proven is Europa crossing Jupiter
 * on 26 January 2014, `programs/europa-transit-2014-01-26.timetag.json`; [docs/hubble.md](../../../docs/hubble.md) says
 * what it measured and what it does not.
 *
 * The arithmetic is in [timetag-reduction.mts](timetag-reduction.mts), which opens no file and is covered by
 * `timetag-frame.test.mts`. This module reads the event list, asks Horizons, writes the image and writes the record. Events
 * are streamed in blocks: an exposure of this kind holds tens of millions of them, and none is kept after it is counted.
 *
 * The image carries a real sky WCS about the target's position at the middle of the exposure, so `@cssearth/fits`
 * reads its orientation like any other sky image. That is a statement about the grid's axes, not about the sky standing
 * still: the target moved, and the WCS says where it was at one instant. */
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFitsFileHdus, type FitsFileHdu } from '@cssearth/fits/node';
import { skyImageAxes } from '@cssearth/fits';
import { positionalArguments } from '@cssearth/core';
import { headerBlock, padBlock } from '../interferometry/fits-table.mts';
import { assertInputPins, fileSize, writeProductRecord } from '@cssearth/telescope/node';
import type { ProductEvidence, ProductInput, ProductRun } from '@cssearth/telescope';
import { PROGRAMS } from './archive.mts';
import { horizonsColumn, horizonsResponse, matchHorizonsEpochs, parseHorizonsTable, readHorizonsResponses, writeHorizonsResponses } from './line-stack-ephemeris.mts';
import {
  azimuthalRatio, backgroundSurface, findDisc, goodTimeIntervals, gridLatitudeDegrees, inGoodTime, limbStatistics, liveSeconds,
  parseTimeTagDefinition, quadraticFit, restFramePixel, sliceLiveSeconds, spanSeconds,
  type GoodTimeInterval, type SectorStatistics, type TimeTagDefinition,
} from './timetag-reduction.mts';

const MJD_TO_JD = 2400000.5;
/** Degree of the polynomial that stands in for the smooth background, and how far out it is fitted, in body radii. */
const BACKGROUND_DEGREE = 3, BACKGROUND_MASK_RADII = 1.6;
/** How far out the azimuthal average is taken, in body radii. */
const AZIMUTHAL_RADII = 6;
/** Blocks of about four megabytes, so a file of half a gigabyte is read in a hundred or so reads. */
const BLOCK_BYTES = 1 << 22;
type Card = readonly [string, string | number | boolean, string?];

// ---- the event list --------------------------------------------------------------------------------------------------
export interface EventsFile {
  readonly path: string;
  readonly rootname: string; readonly aperture: string; readonly opticalElement: string;
  readonly exposureSeconds: number; readonly startMjd: number; readonly endMjd: number;
  /** Position angle of the detector's second axis, degrees east of north. */
  readonly positionAngleDegrees: number;
  readonly events: number; readonly rowBytes: number; readonly dataStart: number;
  readonly tickSeconds: number;
  readonly intervals: readonly GoodTimeInterval[];
}

const cardNumber = (header: Record<string, unknown>, key: string, name: string) => {
  const value = header[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} carries no numeric ${key}.`);
  return value;
};
const cardText = (header: Record<string, unknown>, key: string, name: string) => {
  const value = header[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} carries no ${key}.`);
  return value.trim();
};

/** What the file says about itself, and its good-time intervals. The events themselves are read later, in blocks.
 *
 * The four columns a STIS TIME-TAG table holds are `TIME`, `AXIS1`, `AXIS2` and `DETAXIS1`, in that order and at fixed
 * widths, and only the first three are read here. `TIME` is stored as whole ticks with the seconds per tick in `TSCAL1`,
 * which is checked against the definition rather than taken on trust: a file scaled differently would move every event. */
export async function readEventsFile(path: string, definition: TimeTagDefinition): Promise<EventsFile> {
  const name = basename(path);
  const hdus = await readFitsFileHdus(path);
  const primary = hdus[0]?.header, events = hdus.find(hdu => hdu.header.EXTNAME === 'EVENTS'), gti = hdus.find(hdu => hdu.header.EXTNAME === 'GTI');
  if (!primary || !events || !gti) throw new Error(`${name} is not a TIME-TAG product with EVENTS and GTI tables.`);
  if (events.header.XTENSION !== 'BINTABLE' || gti.header.XTENSION !== 'BINTABLE') throw new Error(`${name} holds EVENTS or GTI as something other than a table.`);
  const columns = ['TIME', 'AXIS1', 'AXIS2', 'DETAXIS1'];
  columns.forEach((column, index) => {
    if (cardText(events.header, `TTYPE${index + 1}`, name) !== column) throw new Error(`${name} does not hold ${column} as column ${index + 1}.`);
  });
  const forms = ['1J', '1I', '1I', '1I'];
  forms.forEach((form, index) => {
    if (cardText(events.header, `TFORM${index + 1}`, name) !== form) throw new Error(`${name} stores column ${index + 1} as something other than ${form}.`);
  });
  const tickSeconds = cardNumber(events.header, 'TSCAL1', name);
  if (Math.abs(tickSeconds - definition.tickSeconds) > definition.tickSeconds * 1e-9)
    throw new Error(`${name} counts time in ${tickSeconds} s ticks; the pin says ${definition.tickSeconds} s.`);
  const rootname = cardText(primary, 'ROOTNAME', name).toLowerCase();
  if (rootname !== definition.rootname) throw new Error(`${name} carries rootname ${rootname}; the pin says ${definition.rootname}.`);
  if (cardText(primary, 'APERTURE', name) !== definition.aperture || cardText(primary, 'OPT_ELEM', name) !== definition.opticalElement)
    throw new Error(`${name} is not the pinned ${definition.aperture} ${definition.opticalElement} exposure.`);
  return {
    path, rootname, aperture: cardText(primary, 'APERTURE', name), opticalElement: cardText(primary, 'OPT_ELEM', name),
    exposureSeconds: cardNumber(events.header, 'EXPTIME', name), startMjd: cardNumber(primary, 'TEXPSTRT', name), endMjd: cardNumber(primary, 'TEXPEND', name),
    positionAngleDegrees: cardNumber(events.header, 'PA_APER', name),
    events: events.dimensions[1]!, rowBytes: events.dimensions[0]!, dataStart: events.dataStart, tickSeconds,
    intervals: goodTimeIntervals(await readGoodTime(path, gti, name)),
  };
}

/** The `START` and `STOP` of every good-time interval, both stored as doubles. */
async function readGoodTime(path: string, gti: FitsFileHdu, name: string): Promise<GoodTimeInterval[]> {
  const rows = gti.dimensions[1]!, rowBytes = gti.dimensions[0]!;
  if (rowBytes !== 16 || cardText(gti.header, 'TTYPE1', name) !== 'START' || cardText(gti.header, 'TTYPE2', name) !== 'STOP')
    throw new Error(`${name} does not hold GTI as a START and STOP pair of doubles.`);
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(rows * rowBytes);
    await file.read(bytes, 0, bytes.length, gti.dataStart);
    return Array.from({ length: rows }, (_, row) => [bytes.readDoubleBE(row * rowBytes), bytes.readDoubleBE(row * rowBytes + 8)] as GoodTimeInterval);
  } finally { await file.close(); }
}

/** Every event, in blocks, as a time in seconds and a pair of detector coordinates. Nothing is held after `visit` returns. */
export async function streamEvents(file: EventsFile, visit: (seconds: number, x: number, y: number) => void): Promise<void> {
  const handle = await open(file.path, 'r');
  try {
    const rows = Math.max(1, Math.floor(BLOCK_BYTES / file.rowBytes)), block = Buffer.alloc(rows * file.rowBytes);
    for (let done = 0; done < file.events; done += rows) {
      const take = Math.min(rows, file.events - done);
      await handle.read(block, 0, take * file.rowBytes, file.dataStart + done * file.rowBytes);
      for (let row = 0; row < take; row++) {
        const at = row * file.rowBytes;
        visit(block.readInt32BE(at) * file.tickSeconds, block.readInt16BE(at + 4), block.readInt16BE(at + 6));
      }
    }
  } finally { await handle.close(); }
}

// ---- where the target was --------------------------------------------------------------------------------------------
export interface TargetPlace { readonly julianDate: number; readonly rightAscensionDegrees: number; readonly declinationDegrees: number; readonly angularDiameterArcsec: number }

/** The target's place and apparent size at one instant, from the pinned Horizons response. */
export async function targetPlace(definition: TimeTagDefinition, julianDate: number, mayAsk: boolean): Promise<TargetPlace> {
  const path = resolve(PROGRAMS, definition.horizons.responses);
  const responses = await readHorizonsResponses(path).catch(() => ({}));
  const text = await horizonsResponse(responses, definition.horizons.observer, definition.horizons.target, definition.horizons.quantities, [julianDate], mayAsk);
  if (mayAsk) await writeHorizonsResponses(path, responses);
  const table = parseHorizonsTable(text), row = matchHorizonsEpochs(table, [julianDate])[0]!;
  const value = (prefix: string, label: string) => {
    const number = Number(row[horizonsColumn(table, prefix)]);
    if (!Number.isFinite(number)) throw new Error(`Horizons gave no ${label}.`);
    return number;
  };
  return { julianDate, rightAscensionDegrees: value('R.A.', 'right ascension'), declinationDegrees: value('DEC', 'declination'),
    angularDiameterArcsec: value('Ang-diam', 'angular diameter') };
}

// ---- the stage -------------------------------------------------------------------------------------------------------
export interface TrackedSlice { readonly slice: number; readonly seconds: number; readonly liveSeconds: number; readonly x: number; readonly y: number; readonly significance: number }
export interface TimeTagRun {
  readonly definition: TimeTagDefinition;
  /** Every input as it was actually read: recorded byte count, measured digest. */
  readonly inputs: readonly ProductInput[];
  readonly file: EventsFile;
  readonly place: TargetPlace;
  /** The target's radius in detector coordinates and in output pixels. */
  readonly radiusDetectorPixels: number; readonly radiusGridPixels: number;
  readonly track: readonly TrackedSlice[];
  /** Distance of each measured centre from the fitted drift, detector pixels. */
  readonly trackResidualPixels: readonly number[];
  readonly driftPixels: number;
  readonly liveSeconds: number; readonly spanSeconds: number;
  readonly eventsPlaced: number; readonly eventsOutsideGrid: number; readonly eventsOutsideGoodTime: number;
  /** Counts per second per pixel in the target's frame, and the model built for it. */
  readonly rate: Float64Array; readonly background: Float64Array; readonly model: Float64Array; readonly counts: Float64Array;
  readonly statistics: readonly SectorStatistics[];
}

export interface TimeTagOptions {
  readonly directory: string;
  readonly mayAsk?: boolean;
  readonly verifyDigests?: boolean;
  readonly log?: (line: string) => void;
}

/** Every pinned file, by identity, in the directory the caller named. */
const pinnedFiles = (definition: TimeTagDefinition, directory: string) => new Map(definition.files.map(file => [file.uri, resolve(directory, file.name)]));
const productInputs = (definition: TimeTagDefinition, files: ReadonlyMap<string, string>): Promise<ProductInput[]> =>
  Promise.all(definition.files.map(async file => ({ role: file.role, identity: file.uri, bytes: file.bytes })));

export async function runTimeTagFrame(definition: TimeTagDefinition, options: TimeTagOptions): Promise<TimeTagRun> {
  const log = options.log ?? (() => {});
  const files = pinnedFiles(definition, options.directory);
  // The pins are checked before a byte of science is read: a stage that reduced another file would write a record naming
  // this one.
  const inputs = await productInputs(definition, files);
  if (options.verifyDigests ?? true) await assertInputPins(inputs, files);
  const eventsUri = definition.files.find(file => file.role === 'events')!.uri;
  const file = await readEventsFile(files.get(eventsUri)!, definition);
  const live = liveSeconds(file.intervals), span = spanSeconds(file.intervals);
  log(`${file.events} events; ${file.intervals.length} good-time intervals; ${live.toFixed(1)} s live over a ${span.toFixed(1)} s span`);

  const place = await targetPlace(definition, (file.startMjd + file.endMjd) / 2 + MJD_TO_JD, options.mayAsk ?? false);
  const radiusDetectorPixels = place.angularDiameterArcsec / 2 / definition.plateScaleArcsec;
  const kmPerDetectorPixel = definition.bodyRadiusKm / radiusDetectorPixels;
  const radiusGridPixels = definition.bodyRadiusKm / definition.grid.kmPerPixel;
  log(`${definition.target} was ${place.angularDiameterArcsec.toFixed(4)}" across: ${radiusDetectorPixels.toFixed(2)} detector pixels of radius, ` +
    `${kmPerDetectorPixel.toFixed(2)} km each; ${radiusGridPixels.toFixed(1)} pixels of radius on the output grid`);

  // ---- pass one: follow the target -----------------------------------------------------------------------------------
  const bin = definition.tracking.binPixels, coarse = Math.ceil(definition.detectorPixels / bin), slices = definition.tracking.slices;
  const sliceSeconds = span / slices, sliceLive = sliceLiveSeconds(file.intervals, slices, span);
  const binned = Array.from({ length: slices }, () => new Int32Array(coarse * coarse));
  await streamEvents(file, (seconds, x, y) => {
    if (x < 0 || y < 0 || x >= definition.detectorPixels || y >= definition.detectorPixels) return;
    const slice = Math.min(slices - 1, Math.floor(seconds / sliceSeconds));
    binned[slice]![Math.floor(y / bin) * coarse + Math.floor(x / bin)]!++;
  });
  const whole = new Int32Array(coarse * coarse);
  for (const image of binned) for (let index = 0; index < whole.length; index++) whole[index]! += image[index]!;
  const ranked = Int32Array.from(whole).sort();
  const brightWhole = ranked[Math.floor(ranked.length * 0.75)]! * definition.tracking.brightSurroundShare;
  const search = { width: coarse, height: coarse, radiusPixels: radiusDetectorPixels / bin,
    innerRadii: definition.tracking.innerRadii, outerRadii: definition.tracking.outerRadii };
  const seed = findDisc(whole, { ...search, brightSurround: brightWhole, guess: { x: coarse / 2, y: coarse / 2 }, searchPixels: coarse });
  // `findDisc` answers in the binned image's own continuous coordinates, and one binned unit is `bin` detector units,
  // so multiplying carries the centre straight over. Taking the binned index times `bin` instead would name the corner of
  // the first detector pixel of that bin, half a bin away from where the body is.
  log(`whole exposure: ${definition.target} at detector (${(seed.x * bin).toFixed(1)}, ${(seed.y * bin).toFixed(1)}), missing light ${seed.significance.toFixed(1)} sigma`);

  const track: TrackedSlice[] = [];
  let guess = { x: seed.x, y: seed.y };
  for (const [slice, image] of binned.entries()) {
    if (sliceLive[slice]! <= 0) { log(`slice ${slice}: no good time, skipped`); continue; }
    const found = findDisc(image, { ...search, brightSurround: brightWhole * (sliceLive[slice]! / live), guess, searchPixels: definition.tracking.searchPixels });
    guess = { x: found.x, y: found.y };
    track.push({ slice, seconds: (slice + 0.5) * sliceSeconds, liveSeconds: sliceLive[slice]!, x: found.x * bin, y: found.y * bin, significance: found.significance });
  }
  if (track.length < 3) throw new Error('A drift is fitted through at least three slices that held good time.');
  const middle = span / 2;
  const driftX = quadraticFit(track.map(entry => [entry.seconds - middle, entry.x] as const));
  const driftY = quadraticFit(track.map(entry => [entry.seconds - middle, entry.y] as const));
  const trackResidualPixels = track.map(entry => Math.hypot(entry.x - driftX(entry.seconds - middle), entry.y - driftY(entry.seconds - middle)));
  const driftPixels = Math.hypot(driftX(span - middle) - driftX(-middle), driftY(span - middle) - driftY(-middle));
  const sorted = [...trackResidualPixels].sort((a, b) => a - b);
  log(`drift ${driftPixels.toFixed(1)} detector pixels over the exposure; the fit misses the slice centres by ${sorted[sorted.length >> 1]!.toFixed(2)} px at the median, ${Math.max(...trackResidualPixels).toFixed(2)} at worst`);

  // ---- pass two: count the events again, on the target ----------------------------------------------------------------
  const pixels = definition.grid.pixels;
  const frame = { positionAngleDegrees: file.positionAngleDegrees, scale: kmPerDetectorPixel / definition.grid.kmPerPixel, pixels };
  const counts = new Float64Array(pixels * pixels);
  let eventsPlaced = 0, eventsOutsideGrid = 0, eventsOutsideGoodTime = 0;
  await streamEvents(file, (seconds, x, y) => {
    if (!inGoodTime(file.intervals, seconds)) { eventsOutsideGoodTime++; return; }
    // An event names the detector pixel it fell in, so its continuous place is half a pixel past that index.
    const at = restFramePixel(x + 0.5 - driftX(seconds - middle), y + 0.5 - driftY(seconds - middle), frame);
    if (!at) { eventsOutsideGrid++; return; }
    counts[at[1] * pixels + at[0]]!++; eventsPlaced++;
  });
  log(`${eventsPlaced} events on the ${pixels} by ${pixels} grid, ${eventsOutsideGrid} beyond it, ${eventsOutsideGoodTime} outside a good-time interval`);

  const rate = new Float64Array(counts.length);
  for (let index = 0; index < counts.length; index++) rate[index] = counts[index]! / live;
  const background = backgroundSurface(rate, pixels, radiusGridPixels, BACKGROUND_MASK_RADII, BACKGROUND_DEGREE);
  const model = azimuthalRatio(rate, background, pixels, radiusGridPixels, AZIMUTHAL_RADII);
  const statistics = definition.sectors.flatMap(sector => sector.binPixels.map(binPixels => limbStatistics(rate, model, pixels, radiusGridPixels, live, sector, binPixels)));
  for (const entry of statistics) log(`${entry.sector} at ${entry.binPixels} by ${entry.binPixels}: darkest bin z ${entry.claimed.darkest.z.toFixed(2)} ` +
    `at latitude ${entry.claimed.darkest.latitudeDegrees.toFixed(0)}, ${entry.darkestOverAnnulusScatter.toFixed(2)} in units of the limb annulus scatter ` +
    `(control scatter ${entry.control.standardDeviation.toFixed(2)}, mirrored band darkest ${entry.mirrored.darkest.z.toFixed(2)})`);

  return { definition, inputs, file, place, radiusDetectorPixels, radiusGridPixels, track, trackResidualPixels, driftPixels,
    liveSeconds: live, spanSeconds: span, eventsPlaced, eventsOutsideGrid, eventsOutsideGoodTime, rate, background, model, counts, statistics };
}

// ---- the image -------------------------------------------------------------------------------------------------------
/** The image, with a real sky WCS about where the target stood at the middle of the exposure.
 *
 * The grid runs north up the rows and west along the columns, so right ascension falls as the column grows and declination
 * rises as the row grows: `CD1_1` negative, `CD2_2` positive, no cross terms. That is axis aligned, which is what
 * `skyImageAxes` accepts, and it reads back as east on the left. */
export function timeTagProduct(run: TimeTagRun): Buffer {
  const definition = run.definition, pixels = definition.grid.pixels;
  const degreesPerPixel = definition.grid.kmPerPixel / definition.bodyRadiusKm * run.radiusDetectorPixels * definition.plateScaleArcsec / 3600;
  const cards: Card[] = [
    ['TARGNAME', definition.target], ['INSTRUME', definition.instrument], ['OPT_ELEM', definition.opticalElement],
    ['APERTURE', definition.aperture], ['ROOTNAME', definition.rootname], ['PROPOSID', Number(definition.programme)],
    ['EXPTIME', run.liveSeconds, 'seconds of good time counted'], ['SPANTIME', run.spanSeconds, 'seconds from the first tick to the last'],
    ['MJD-OBS', run.file.startMjd], ['MJD-END', run.file.endMjd],
    ['RADESYS', 'ICRS'],
    ['CTYPE1', 'RA---TAN'], ['CTYPE2', 'DEC--TAN'], ['CUNIT1', 'deg'], ['CUNIT2', 'deg'],
    // The target stands at continuous `pixels / 2`, the corner between the two middle pixels; FITS counts from one and
    // puts pixel centres on whole numbers, so the same place is `pixels / 2 + 0.5` there.
    ['CRPIX1', pixels / 2 + 0.5, 'the target at mid-exposure'], ['CRPIX2', pixels / 2 + 0.5],
    ['CRVAL1', run.place.rightAscensionDegrees], ['CRVAL2', run.place.declinationDegrees],
    ['CD1_1', -degreesPerPixel, 'right ascension falls along columns: east is left'], ['CD1_2', 0],
    ['CD2_1', 0], ['CD2_2', degreesPerPixel, 'declination rises along rows: north is up'],
    ['KMPERPIX', definition.grid.kmPerPixel, 'km at the target'], ['BODYRAD', definition.bodyRadiusKm, 'km, the target radius'],
    ['BODYRPIX', run.radiusGridPixels, 'pixels, the target radius on this grid'],
    ['ANGDIAM', run.place.angularDiameterArcsec, 'arcsec, apparent diameter at mid-exposure'],
    ['PA_APER', run.file.positionAngleDegrees, 'degrees, detector axis 2 east of north'],
    ['NEVENTS', run.eventsPlaced, 'TIME-TAG events counted on this grid'],
    ['DRIFTPIX', run.driftPixels, 'detector pixels the target moved'],
    ['GEOCORR', 'OMIT', 'detector geometric distortion is not corrected'],
    ['STACKID', definition.id], ['ORIGIN', 'cssEarth tools/objects/hst/timetag-frame.mts'],
  ];
  const extension = (values: Float64Array, name: string, unit: string, note: string) => {
    const data = Buffer.alloc(values.length * 4);
    values.forEach((value, index) => data.writeFloatBE(Number.isFinite(value) ? value : 0, index * 4));
    return Buffer.concat([headerBlock([['XTENSION', 'IMAGE'], ['BITPIX', -32], ['NAXIS', 2], ['NAXIS1', pixels], ['NAXIS2', pixels],
      ['PCOUNT', 0], ['GCOUNT', 1], ['EXTNAME', name], ['BUNIT', unit, note], ...cards]), padBlock(data)]);
  };
  const significance = new Float64Array(pixels * pixels);
  for (let index = 0; index < significance.length; index++) {
    const expected = run.model[index]! * run.liveSeconds;
    significance[index] = expected > 0 ? (expected - run.counts[index]!) / Math.sqrt(expected) : Number.NaN;
  }
  return Buffer.concat([
    headerBlock([['SIMPLE', true, 'conforms to FITS standard'], ['BITPIX', 8], ['NAXIS', 0], ['EXTEND', true], ...cards]),
    extension(run.rate, 'SCI', 'count/s/pixel', 'events per second in the target frame'),
    extension(run.counts, 'COUNTS', 'count', 'events counted, before the exposure is divided out'),
    extension(run.background, 'BACKGND', 'count/s/pixel', 'polynomial surface fitted outside the target'),
    extension(run.model, 'MODEL', 'count/s/pixel', 'the background times the azimuthal average of SCI over it'),
    extension(significance, 'SIGMA', '', 'missing light per pixel, in Poisson standard deviations'),
  ]);
}

/** The middle of a square image, `half` pixels each way about its centre, rows and columns kept in order. The grid holds an
 * even number of pixels and the target stands at continuous `size / 2`, so the crop starts at `size / 2 - half` and the
 * target lands at continuous `half` in it, which is the middle of the crop by the same convention. */
export function centredCrop(values: Float64Array, size: number, half: number): { readonly size: number; readonly values: Float64Array } {
  if (!Number.isSafeInteger(size) || size % 2 !== 0) throw new RangeError('A centred crop is taken from a grid of an even number of pixels.');
  const from = size / 2 - half;
  if (!Number.isSafeInteger(half) || !(half > 0) || from < 0 || from + 2 * half > size) throw new RangeError('The crop does not fit inside the image.');
  const out = new Float64Array(4 * half * half);
  for (let row = 0; row < 2 * half; row++) out.set(values.subarray((from + row) * size + from, (from + row) * size + from + 2 * half), row * 2 * half);
  return { size: 2 * half, values: out };
}

/** How far the picture reaches from the target's centre, in target radii. */
export const PICTURE_HALF_WIDTH_RADII = 4;

/** The picture: the rate image about the target as one primary image, small enough to keep beside a body as a source file
 * and readable by anything that reads a plain FITS sky image. Same grid, same WCS, reference pixel moved with the crop. */
export function timeTagPicture(run: TimeTagRun): Buffer {
  const definition = run.definition, pixels = definition.grid.pixels, crop = centredCrop(run.rate, pixels, Math.ceil(PICTURE_HALF_WIDTH_RADII * run.radiusGridPixels));
  const degreesPerPixel = definition.grid.kmPerPixel / definition.bodyRadiusKm * run.radiusDetectorPixels * definition.plateScaleArcsec / 3600;
  const data = Buffer.alloc(crop.values.length * 4);
  crop.values.forEach((value, index) => data.writeFloatBE(Number.isFinite(value) ? value : 0, index * 4));
  return Buffer.concat([headerBlock([['SIMPLE', true, 'conforms to FITS standard'], ['BITPIX', -32], ['NAXIS', 2], ['NAXIS1', crop.size], ['NAXIS2', crop.size],
    ['BUNIT', 'count/s/pixel', 'events per second in the target frame'], ['TARGNAME', definition.target], ['INSTRUME', definition.instrument], ['OPT_ELEM', definition.opticalElement], ['ROOTNAME', definition.rootname],
    ['EXPTIME', run.liveSeconds, 'seconds of good time counted'], ['MJD-OBS', run.file.startMjd], ['RADESYS', 'ICRS'], ['CTYPE1', 'RA---TAN'], ['CTYPE2', 'DEC--TAN'], ['CUNIT1', 'deg'], ['CUNIT2', 'deg'],
    // The crop is centred, so the target stands at continuous `crop.size / 2` in it and FITS names that place one further on.
    ['CRPIX1', crop.size / 2 + 0.5, 'the target at mid-exposure'], ['CRPIX2', crop.size / 2 + 0.5], ['CRVAL1', run.place.rightAscensionDegrees], ['CRVAL2', run.place.declinationDegrees],
    ['CD1_1', -degreesPerPixel, 'east is left'], ['CD1_2', 0], ['CD2_1', 0], ['CD2_2', degreesPerPixel, 'north is up'],
    ['KMPERPIX', definition.grid.kmPerPixel, 'km at the target'], ['BODYRPIX', run.radiusGridPixels, 'pixels, the target radius on this grid'], ['STACKID', definition.id], ['ORIGIN', 'cssEarth tools/objects/hst/timetag-frame.mts']]), padBlock(data)]);
}

export async function writeProducts(run: TimeTagRun, outputDirectory: string): Promise<readonly string[]> {
  await mkdir(outputDirectory, { recursive: true });
  const name = `${run.definition.id}.fits`;
  const product = timeTagProduct(run);
  await writeFile(resolve(outputDirectory, name), product);
  await writeFile(resolve(outputDirectory, `${run.definition.id}.picture.fits`), timeTagPicture(run));
  // The header is read back with the shared sky reader, so a grid this stage could not state as a sky image never ships.
  const header = (await readFitsFileHdus(resolve(outputDirectory, name)))[1]!.header;
  const axes = skyImageAxes(header);
  if (axes.eastRight || !axes.northUp) throw new Error('The written image does not read back as north up and east left.');
  await writeFile(resolve(outputDirectory, 'tracking.json'), `${JSON.stringify({ definition: run.definition.id, rootname: run.definition.rootname,
    liveSeconds: run.liveSeconds, spanSeconds: run.spanSeconds, goodTimeIntervals: run.file.intervals,
    place: run.place, radiusDetectorPixels: run.radiusDetectorPixels, driftPixels: run.driftPixels,
    track: run.track, residualPixels: run.trackResidualPixels }, null, 1)}\n`);
  return [name, `${run.definition.id}.picture.fits`, 'tracking.json'];
}

const round = (value: number, places: number) => Number(value.toFixed(places));

/** What this run measured, beside what other people published for the same thing and what it could not do at all. */
export function timeTagReceipt(run: TimeTagRun) {
  const definition = run.definition;
  const residuals = [...run.trackResidualPixels].sort((a, b) => a - b);
  return {
    schema: 'cssearth-hst-timetag-frame-reproduction@1',
    stack: definition.id,
    definition: `tools/objects/hst/programs/${definition.id}.timetag.json`,
    target: definition.target, instrument: definition.instrument, opticalElement: definition.opticalElement,
    aperture: definition.aperture, programme: definition.programme, rootname: definition.rootname,
    exposure: {
      events: run.file.events, eventsPlaced: run.eventsPlaced, eventsOutsideGrid: run.eventsOutsideGrid, eventsOutsideGoodTime: run.eventsOutsideGoodTime,
      goodTimeIntervals: run.file.intervals.length, liveSeconds: round(run.liveSeconds, 2), spanSeconds: round(run.spanSeconds, 2),
      statedExposureSeconds: round(run.file.exposureSeconds, 2),
    },
    tracking: {
      slices: definition.tracking.slices, slicesMeasured: run.track.length,
      driftDetectorPixels: round(run.driftPixels, 2),
      residualDetectorPixels: { median: round(residuals[residuals.length >> 1]!, 2), worst: round(residuals[residuals.length - 1]!, 2) },
      /** The worst residual in the units the picture is drawn in: how far the fit can smear a feature on the output grid. */
      residualGridPixels: round(residuals[residuals.length - 1]! * (definition.bodyRadiusKm / run.radiusDetectorPixels) / definition.grid.kmPerPixel, 2),
    },
    geometry: {
      angularDiameterArcsec: round(run.place.angularDiameterArcsec, 4),
      kmPerDetectorPixel: round(definition.bodyRadiusKm / run.radiusDetectorPixels, 2),
      kmPerGridPixel: definition.grid.kmPerPixel,
      bodyRadiusGridPixels: round(run.radiusGridPixels, 2),
      orientation: 'north up, east left', positionAngleDegrees: round(run.file.positionAngleDegrees, 4),
      rightAscensionDegrees: run.place.rightAscensionDegrees, declinationDegrees: run.place.declinationDegrees,
    },
    sectors: run.statistics.map(entry => ({
      sector: entry.sector, binPixels: entry.binPixels,
      claimed: { latitudeRange: entry.claimed.latitudeRange, bins: entry.claimed.bins,
        darkestZ: round(entry.claimed.darkest.z, 2), atLatitudeDegrees: round(entry.claimed.darkest.latitudeDegrees, 1), atRadii: round(entry.claimed.darkest.radii, 3) },
      mirrored: { latitudeRange: entry.mirrored.latitudeRange, bins: entry.mirrored.bins, darkestZ: round(entry.mirrored.darkest.z, 2) },
      /** A control annulus away from the body should give a standard deviation of one. It does not, so the formal z above
       * is larger than the departure it stands for, and both normalisations are kept. */
      controlScatter: round(entry.control.standardDeviation, 2), controlMean: round(entry.control.mean, 2), controlBins: entry.control.bins,
      limbAnnulusScatter: round(entry.annulus.standardDeviation, 2), limbAnnulusBins: entry.annulus.bins,
      darkestOverAnnulusScatter: round(entry.darkestOverAnnulusScatter, 2),
      darkestOverControlScatter: round(entry.darkestOverControlScatter, 2),
    })),
    published: definition.published,
    measured: definition.notes.measured,
    notVerified: definition.notes.notVerified,
  };
}

/** The product record: what went in, what this stage did, what came out, and what each check establishes. */
export async function writeRecord(run: TimeTagRun, outputDirectory: string, written: readonly string[]) {
  const definition = run.definition, image = written[0]!;
  const productRun: ProductRun = {
    telescope: 'HST', stage: 'timetag-frame',
    inputs: run.inputs,
    parameters: {
      definition: definition.id, target: definition.target, horizonsTarget: definition.horizonsTarget,
      bodyRadiusKm: definition.bodyRadiusKm, grid: definition.grid, tracking: definition.tracking,
      backgroundDegree: BACKGROUND_DEGREE, backgroundMaskRadii: BACKGROUND_MASK_RADII, azimuthalRadii: AZIMUTHAL_RADII,
      sectors: definition.sectors,
    },
    software: [{ name: 'node', version: process.versions.node }, { name: 'cssearth-hst-timetag-frame', version: '1' }],
  };
  const receipt = `tools/objects/hst/programs/${definition.id}.timetag.reproduction.json`;
  const evidence: ProductEvidence[] = [
    { kind: 'geometric-registration', receipt, product: image,
      establishes: `The target was followed across the detector and the events recounted on its own grid; the fitted drift misses the measured slice centres by ${run.trackResidualPixels.length ? Math.max(...run.trackResidualPixels).toFixed(2) : '0'} detector pixels at worst.` },
    { kind: 'published-value', receipt, product: image,
      establishes: `The target's radius on this grid, ${run.radiusGridPixels.toFixed(1)} pixels, and the darkest-bin statistics in the claimed sector are reported beside the published values in the definition.` },
    { kind: 'internal-consistency', receipt, product: image,
      establishes: 'The scatter of the same statistic in a control annulus away from the target says how far the model departs from pure counting noise, so both normalisations of the darkest bin are reported.' },
  ];
  return writeProductRecord(resolve(outputDirectory, `${image}.product.json`), productRun,
    written.map(name => ({ path: name, file: resolve(outputDirectory, name) })),
    evidence.map(entry => ({ ...entry })));
}

export const definitionPath = (id: string) => resolve(PROGRAMS, `${id}.timetag.json`);
export const readTimeTagDefinition = async (id: string) => parseTimeTagDefinition(JSON.parse(await readFile(definitionPath(id), 'utf8')));

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), flags = args.filter(argument => argument.startsWith('--')), rest = positionalArguments(args);
  const [id, directory, output] = rest;
  if (!id || !directory || !output) {
    console.error('usage: timetag-frame.mts <definition id> <files directory> <output directory> [--fetch] [--receipt] [--no-verify]');
    process.exit(2);
  }
  const unknown = flags.filter(flag => !['--fetch', '--receipt', '--no-verify'].includes(flag));
  if (unknown.length) { console.error(`unknown option ${unknown.join(' ')}`); process.exit(2); }
  const definition = await readTimeTagDefinition(id);
  const run = await runTimeTagFrame(definition, { directory, mayAsk: flags.includes('--fetch'), verifyDigests: !flags.includes('--no-verify'), log: line => console.log(line) });
  const written = await writeProducts(run, output);
  const record = await writeRecord(run, output, written);
  console.log(`wrote ${written.join(', ')} and ${written[0]}.product.json to ${output} (${record.outputs.length} outputs pinned)`);
  if (flags.includes('--receipt')) {
    const path = resolve(PROGRAMS, `${definition.id}.timetag.reproduction.json`);
    await writeFile(path, `${JSON.stringify(timeTagReceipt(run), null, 1)}\n`);
    console.log(`wrote ${path}`);
  }
}
