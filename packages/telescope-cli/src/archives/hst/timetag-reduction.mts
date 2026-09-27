/** The arithmetic of rebuilding a TIME-TAG exposure in a moving target's own rest frame. Nothing here opens a file or asks
 * the network, so every step below is checked by `timetag-frame.test.mts` on event lists small enough to write out by hand.
 *
 * A STIS MAMA detector records a position and a time for every photon it counts. When the telescope follows a body that
 * moves, and a commanded drift is laid on top of that to spread detector blemishes out, the body wanders across the
 * detector during the exposure and the summed image smears it. The cure needs no resampling: each event is moved by where
 * the body was at that event's own time, and the events are counted again on a grid fixed to the body.
 *
 * Four things have to be right for that to work, and each is a function here:
 *
 * - **which time counts.** A buffer dump pauses the counting, so the exposure's wall span is longer than the time it
 *   collected. `liveSeconds` and `sliceLiveSeconds` take the good-time intervals as the file states them.
 * - **where the body was.** `findDisc` looks for the body, not for the darkest place: a dark disc of the body's own size
 *   standing on a bright surround, scored by how many standard deviations of Poisson noise the missing light is. Scoring
 *   by plain contrast instead finds the unlit corner of the detector every time.
 * - **how the track is smoothed.** A commanded drift is smooth and a per-slice centre is not, so `quadraticFit` (shared
 *   with the line stack) is fitted through the slices and the fit, not the slices, moves the events.
 * - **which way the sky lies.** `restFramePixel` rotates by the aperture's own position angle so that the output grid is
 *   north up and east left, with no flip: the sky's handedness is already the detector's.
 *
 * What comes out is counted light, so the question asked of it is a counting question. `backgroundSurface` and
 * `azimuthalRatio` build the model the counts are compared against, and `limbStatistics` reports how far each bin departs
 * from it in units of Poisson noise, together with the scatter of that departure in a control annulus away from the body.
 * Those two numbers belong together: when the control scatter is not one, the model is missing something and a bin's
 * formal significance is not the significance it looks like.
 *
 * **One coordinate convention, everywhere.** Pixel `i` covers the continuous range `[i, i + 1)`, so its centre sits at
 * `i + 0.5` and a continuous coordinate is binned with `Math.floor`, never with `Math.round`. A body centred on the grid
 * stands at continuous `N / 2`, which is the corner between pixels `N / 2 - 1` and `N / 2`, and the FITS reference pixel
 * for it is `N / 2 + 0.5` because FITS counts pixels from one and puts their centres on whole numbers. Every function
 * here takes and returns continuous coordinates except where it is naming a stored pixel: `findDisc` answers in
 * continuous coordinates, `restFramePixel` answers with the index the event is counted in, and `gridRadii` and
 * `gridLatitudeDegrees` take an index and add the half pixel themselves. Mixing the two puts a symmetric cloud of events
 * half a pixel off its own centre, which at 35 km to the pixel is 17.5 km on each axis. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { quadraticFit } from './line-stack-reduction.mts';

export { quadraticFit };

const DEGREE = Math.PI / 180;

// ---- the pinned definition ----------------------------------------------------------------------------------------
/** One file the stage reads, pinned by where the archive keeps it and by what it is. */
export interface TimeTagFile { readonly role: string; readonly uri: string; readonly name: string; readonly bytes: number }
/** The requests that place the target, and the file beside the definition that holds the raw text they returned. */
export interface TimeTagHorizons {
  readonly observer: string; readonly target: string; readonly quantities: string; readonly responses: string;
}
/** The output grid, fixed to the body: square, so many kilometres to the pixel, the body centred. */
export interface TimeTagGrid { readonly pixels: number; readonly kmPerPixel: number }
/** How the body is followed across the detector. */
export interface TimeTagTracking {
  /** How many equal parts of the exposure's wall span a centre is measured in. */
  readonly slices: number;
  /** Half-widths, in body radii, of the box taken as inside the body and of the square whose rim is the surround. */
  readonly innerRadii: number; readonly outerRadii: number;
  /** Detector pixels binned together while the body is followed. The search is coarse; the events are not. */
  readonly binPixels: number;
  /** A candidate is only the body when its surround is at least this share of the frame's own bright level. */
  readonly brightSurroundShare: number;
  /** How far from the previous slice's centre a later slice is searched, in binned pixels. */
  readonly searchPixels: number;
}
/** The region a published claim is about, and the control region its statistics are judged against. */
export interface TimeTagSector {
  readonly id: string;
  /** Body radii: the annulus just off the limb the claim is made in. */
  readonly annulusRadii: readonly [number, number];
  /** Planetographic latitude range, degrees, taken on the limb (the sub-observer latitude is near zero here). */
  readonly latitudeRange: readonly [number, number];
  /** Body radii: an annulus far enough out to hold no body signal, where the statistics are checked. */
  readonly controlRadii: readonly [number, number];
  /** Square bin sizes, output pixels, the statistics are computed on. */
  readonly binPixels: readonly number[];
  readonly note?: string;
}
/** A number someone else published, kept beside the pin so that a receipt puts this run's number next to it. */
export interface TimeTagPublished {
  readonly id: string; readonly quantity: string; readonly value: number; readonly uncertainty?: number;
  readonly unit: string; readonly source: string;
}
export interface TimeTagDefinition {
  readonly schema: 'cssearth-hst-timetag-frame@1';
  readonly id: string;
  readonly target: string;
  /** The Horizons body the target is, `502` for Europa. */
  readonly horizonsTarget: string;
  readonly bodyRadiusKm: number;
  readonly instrument: string;
  readonly opticalElement: string;
  readonly aperture: string;
  readonly programme: string;
  readonly rootname: string;
  /** Seconds per TIME tick, the `TSCAL` the events table states; refused when the file disagrees. */
  readonly tickSeconds: number;
  /** Arcseconds per event coordinate. A MAMA records TIME-TAG at twice the sampling of an accumulated image. */
  readonly plateScaleArcsec: number;
  /** How wide the event coordinates run, in their own units. */
  readonly detectorPixels: number;
  readonly files: readonly TimeTagFile[];
  readonly horizons: TimeTagHorizons;
  readonly grid: TimeTagGrid;
  readonly tracking: TimeTagTracking;
  readonly sectors: readonly TimeTagSector[];
  readonly published: readonly TimeTagPublished[];
  /** What this run's numbers rest on, kept beside the pin so that every receipt carries it. */
  readonly notes: { readonly measured: readonly string[]; readonly notVerified: readonly string[] };
}

const NAME = /^[a-z0-9][a-z0-9.-]*$/u;
const HEX64 = /^[0-9a-f]{64}$/u;
const positive = (value: unknown, label: string) => {
  const number = requireFiniteNumber(value, label);
  if (!(number > 0)) throw new TypeError(`${label} is positive.`);
  return number;
};
const wholeNumber = (value: unknown, label: string) => {
  const number = requireFiniteNumber(value, label);
  if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`${label} is a whole number of at least one.`);
  return number;
};
const ordered = (value: unknown, label: string): [number, number] => {
  const pair = requireArray(value, label).map(entry => requireFiniteNumber(entry, label));
  if (pair.length !== 2 || !(pair[0]! < pair[1]!)) throw new TypeError(`${label} is a pair running from low to high.`);
  return [pair[0]!, pair[1]!];
};

/** A pinned definition with every external value checked. Nothing about one body is written into this stage: the target,
 * its radius, the grid, the tracking and the claims are all read from here. */
export function parseTimeTagDefinition(value: unknown): TimeTagDefinition {
  const row = requireRecord(value, 'TIME-TAG definition');
  if (row.schema !== 'cssearth-hst-timetag-frame@1') throw new TypeError(`Unsupported TIME-TAG definition schema ${String(row.schema)}.`);
  const id = requireString(row.id, 'Definition id');
  if (!NAME.test(id)) throw new TypeError(`${id} is not a definition id.`);
  const files = requireArray(row.files, 'Files').map(raw => {
    const file = requireRecord(raw, 'File');
    return { role: requireString(file.role, 'File role'), uri: requireString(file.uri, 'File uri'), name: requireString(file.name, 'File name'),
      bytes: wholeNumber(file.bytes, 'File bytes') };
  });
  if (!files.some(file => file.role === 'events')) throw new TypeError('A TIME-TAG definition pins the events file.');
  const horizonsRow = requireRecord(row.horizons, 'Horizons');
  const responses = requireString(horizonsRow.responses, 'Horizons responses');
  // The responses live beside the definition. A path would let a run read text from anywhere, which is not a pin.
  if (!/^[A-Za-z0-9._-]+$/u.test(responses)) throw new TypeError('The pinned Horizons responses are a file name beside the definition.');
  const gridRow = requireRecord(row.grid, 'Grid');
  const pixels = wholeNumber(gridRow.pixels, 'Grid pixels');
  if (pixels % 2 !== 0) throw new TypeError('The grid holds an even number of pixels, so the body centre falls on a pixel corner.');
  const trackingRow = requireRecord(row.tracking, 'Tracking');
  const tracking: TimeTagTracking = {
    slices: wholeNumber(trackingRow.slices, 'Tracking slices'),
    innerRadii: positive(trackingRow.innerRadii, 'Tracking innerRadii'), outerRadii: positive(trackingRow.outerRadii, 'Tracking outerRadii'),
    binPixels: wholeNumber(trackingRow.binPixels, 'Tracking binPixels'),
    brightSurroundShare: positive(trackingRow.brightSurroundShare, 'Tracking brightSurroundShare'),
    searchPixels: wholeNumber(trackingRow.searchPixels, 'Tracking searchPixels'),
  };
  if (!(tracking.innerRadii < tracking.outerRadii)) throw new TypeError('The tracking box sits inside its surround.');
  const sectors = requireArray(row.sectors, 'Sectors').map(raw => {
    const sector = requireRecord(raw, 'Sector'), binPixels = requireArray(sector.binPixels, 'Sector binPixels').map(entry => wholeNumber(entry, 'Sector bin'));
    if (!binPixels.length) throw new TypeError('A sector names at least one bin size.');
    const latitudeRange = ordered(sector.latitudeRange, 'Sector latitudeRange');
    if (latitudeRange[0] < -90 || latitudeRange[1] > 90) throw new TypeError('A sector latitude range lies within the poles.');
    return { id: requireString(sector.id, 'Sector id'), annulusRadii: ordered(sector.annulusRadii, 'Sector annulusRadii'),
      latitudeRange, controlRadii: ordered(sector.controlRadii, 'Sector controlRadii'), binPixels,
      ...(sector.note === undefined ? {} : { note: requireString(sector.note, 'Sector note') }) };
  });
  const published = requireArray(row.published, 'Published').map(raw => {
    const entry = requireRecord(raw, 'Published value');
    return { id: requireString(entry.id, 'Published id'), quantity: requireString(entry.quantity, 'Published quantity'),
      value: requireFiniteNumber(entry.value, 'Published value'),
      ...(entry.uncertainty === undefined ? {} : { uncertainty: positive(entry.uncertainty, 'Published uncertainty') }),
      unit: requireString(entry.unit, 'Published unit'), source: requireString(entry.source, 'Published source') };
  });
  const notesRow = requireRecord(row.notes, 'Notes');
  const lines = (raw: unknown, label: string) => requireArray(raw, label).map(entry => requireString(entry, label));
  return {
    schema: 'cssearth-hst-timetag-frame@1', id,
    target: requireString(row.target, 'Target'), horizonsTarget: requireString(row.horizonsTarget, 'Horizons target'),
    bodyRadiusKm: positive(row.bodyRadiusKm, 'Body radius'),
    instrument: requireString(row.instrument, 'Instrument'), opticalElement: requireString(row.opticalElement, 'Optical element'),
    aperture: requireString(row.aperture, 'Aperture'), programme: requireString(row.programme, 'Programme'),
    rootname: requireString(row.rootname, 'Rootname'),
    tickSeconds: positive(row.tickSeconds, 'Tick seconds'), plateScaleArcsec: positive(row.plateScaleArcsec, 'Plate scale'),
    detectorPixels: wholeNumber(row.detectorPixels, 'Detector pixels'),
    files,
    horizons: { observer: requireString(horizonsRow.observer, 'Horizons observer'), target: requireString(horizonsRow.target, 'Horizons target'),
      quantities: requireString(horizonsRow.quantities, 'Horizons quantities'), responses },
    grid: { pixels, kmPerPixel: positive(gridRow.kmPerPixel, 'Grid kmPerPixel') },
    tracking, sectors, published,
    notes: { measured: lines(notesRow.measured, 'Measured note'), notVerified: lines(notesRow.notVerified, 'Not-verified note') },
  };
}

// ---- good time ------------------------------------------------------------------------------------------------------
export type GoodTimeInterval = readonly [number, number];

/** The intervals the detector was actually counting in, checked: each runs forwards and none overlaps the one before. */
export function goodTimeIntervals(values: readonly GoodTimeInterval[]): GoodTimeInterval[] {
  const sorted = [...values].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([start, stop], index) => {
    if (!(Number.isFinite(start) && Number.isFinite(stop) && stop > start)) throw new RangeError(`Good-time interval ${index} does not run forwards.`);
    const previous = sorted[index - 1];
    if (previous && start < previous[1]) throw new RangeError(`Good-time interval ${index} overlaps the one before it.`);
  });
  if (!sorted.length) throw new RangeError('An exposure holds at least one good-time interval.');
  return sorted;
}

/** Seconds of counting, which is shorter than the wall span whenever a buffer dump paused the exposure. */
export const liveSeconds = (intervals: readonly GoodTimeInterval[]) => intervals.reduce((total, [start, stop]) => total + (stop - start), 0);

/** The wall span, from zero to the last interval's end: the range the tracking slices divide. */
export const spanSeconds = (intervals: readonly GoodTimeInterval[]) => intervals.reduce((last, [, stop]) => Math.max(last, stop), 0);

/** Seconds of counting inside each equal slice of the wall span. A slice that falls inside a buffer dump gets none, and no
 * centre is measured in it. */
export function sliceLiveSeconds(intervals: readonly GoodTimeInterval[], slices: number, span: number): Float64Array {
  if (!Number.isSafeInteger(slices) || slices < 1) throw new RangeError('An exposure is divided into at least one slice.');
  const live = new Float64Array(slices), width = span / slices;
  for (const [start, stop] of intervals) for (let slice = 0; slice < slices; slice++) {
    const low = Math.max(start, slice * width), high = Math.min(stop, (slice + 1) * width);
    if (high > low) live[slice]! += high - low;
  }
  return live;
}

/** Whether an event's time falls in a counting interval. Events outside one are recorded but were not being collected. */
export function inGoodTime(intervals: readonly GoodTimeInterval[], time: number): boolean {
  let low = 0, high = intervals.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1, [start, stop] = intervals[middle]!;
    if (time < start) high = middle - 1;
    else if (time > stop) low = middle + 1;
    else return true;
  }
  return false;
}

// ---- finding the body -----------------------------------------------------------------------------------------------
/** Box sums of an image in constant time, for a search that tries every candidate centre. */
export function boxSums(values: ArrayLike<number>, width: number, height: number) {
  if (values.length !== width * height) throw new RangeError('An image does not match its size.');
  const table = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    table[(y + 1) * (width + 1) + x + 1] = values[y * width + x]! + table[y * (width + 1) + x + 1]! + table[(y + 1) * (width + 1) + x]! - table[y * (width + 1) + x]!;
  /** The sum over columns `x0` up to but not including `x1`, and rows `y0` up to but not including `y1`. */
  return (x0: number, y0: number, x1: number, y1: number) => {
    if (x0 < 0 || y0 < 0 || x1 > width || y1 > height || x1 < x0 || y1 < y0) throw new RangeError('A box sum reaches outside the image.');
    return table[y1 * (width + 1) + x1]! - table[y0 * (width + 1) + x1]! - table[y1 * (width + 1) + x0]! + table[y0 * (width + 1) + x0]!;
  };
}

export interface DiscSearch {
  readonly width: number; readonly height: number;
  /** The body's radius in this image's own pixels. */
  readonly radiusPixels: number;
  readonly innerRadii: number; readonly outerRadii: number;
  /** Counts per pixel a surround must reach to be the primary behind the body rather than empty sky. */
  readonly brightSurround: number;
  readonly guess: { readonly x: number; readonly y: number };
  readonly searchPixels: number;
}
export interface DiscCentre {
  /** The body's centre in this image's own continuous coordinates, where the centre of pixel `i` is `i + 0.5`. */
  readonly x: number; readonly y: number;
  /** How many standard deviations of Poisson noise the missing light of the best box is. */
  readonly significance: number;
  /** Counts per pixel in the surround at that centre. */
  readonly surround: number;
}

/** Where the body sits in one image. Every candidate centre is scored by how much light is missing from a box of the body's
 * size compared with the rim around it, in units of the Poisson noise of the light that rim implies; the best box is then
 * refined to the centroid of the missing light. Scoring by the ratio of the two levels instead picks the darkest place in
 * the frame, which off the primary's disc is the unlit detector, so a surround below `brightSurround` is not a candidate. */
export function findDisc(image: ArrayLike<number>, search: DiscSearch): DiscCentre {
  const { width, height, radiusPixels, guess, searchPixels } = search;
  const sum = boxSums(image, width, height);
  const inner = Math.max(1, Math.round(radiusPixels * search.innerRadii)), outer = Math.round(radiusPixels * search.outerRadii);
  if (outer * 2 + 1 > Math.min(width, height)) throw new RangeError('The surround of the body is wider than the image.');
  const box = (cx: number, cy: number, half: number) => sum(cx - half, cy - half, cx + half + 1, cy + half + 1);
  const innerArea = (2 * inner + 1) ** 2, outerArea = (2 * outer + 1) ** 2, rimArea = outerArea - innerArea;
  const low = (value: number) => Math.max(outer, Math.round(value - searchPixels)), high = (value: number, limit: number) => Math.min(limit - outer - 1, Math.round(value + searchPixels));
  let best = -Infinity, bx = Math.round(guess.x), by = Math.round(guess.y), bestSurround = 0;
  for (let y = low(guess.y); y <= high(guess.y, height); y++) for (let x = low(guess.x); x <= high(guess.x, width); x++) {
    const within = box(x, y, inner), around = box(x, y, outer), surround = (around - within) / rimArea;
    if (!(surround >= search.brightSurround)) continue;
    const missing = (surround - within / innerArea) * Math.sqrt(innerArea / surround);
    if (missing > best) { best = missing; bx = x; by = y; bestSurround = surround; }
  }
  if (!Number.isFinite(best)) throw new Error('No candidate for the body stood on a bright enough surround.');
  // The centroid of the missing light, which places the body between pixels rather than on one. The box the search tries
  // at index `bx` covers `bx - inner` to `bx + inner`, so it is symmetric about that pixel's centre, `bx + 0.5`.
  const radius = Math.round(radiusPixels * 1.2);
  let weightedX = 0, weightedY = 0, weight = 0;
  for (let y = Math.max(0, by - radius); y <= Math.min(height - 1, by + radius); y++) for (let x = Math.max(0, bx - radius); x <= Math.min(width - 1, bx + radius); x++) {
    if ((x - bx) ** 2 + (y - by) ** 2 > radius * radius) continue;
    const missing = Math.max(0, bestSurround - image[y * width + x]!);
    weightedX += missing * x; weightedY += missing * y; weight += missing;
  }
  // Both sums are over pixel indices, so half a pixel turns each one into the continuous coordinate of the same place.
  return { x: (weight > 0 ? weightedX / weight : bx) + 0.5, y: (weight > 0 ? weightedY / weight : by) + 0.5,
    significance: best, surround: bestSurround };
}

// ---- the rest frame -------------------------------------------------------------------------------------------------
export interface RestFrame {
  /** Position angle of the detector's second axis, degrees east of north: the exposure's own `PA_APER`. */
  readonly positionAngleDegrees: number;
  /** Output pixels per detector pixel. */
  readonly scale: number;
  /** Output pixels across, even, with the body centred on the middle corner. */
  readonly pixels: number;
}

/** Which stored pixel a detector event is counted in, given the continuous offset (`dx`, `dy`) from where the body was at
 * that event's own time.
 *
 * The output runs north up the rows and west along the columns, so east is on the left when the first row is drawn at the
 * bottom, which is how a sky image is displayed. No flip is applied: on the sky the pair (east, north) is already left
 * handed against the detector's (x, y), so the rotation alone puts it right, and applying a flip as well would mirror
 * every image east for west.
 *
 * The offsets are continuous and the answer is an index, so the continuous coordinate is floored. Rounding it instead
 * would count an event that landed exactly on the body at the pixel whose centre is half a pixel past the body, and a
 * cloud of events symmetric about the body would come out half a pixel off in each axis. Returns undefined for an event
 * outside the grid. */
export function restFramePixel(dx: number, dy: number, frame: RestFrame): readonly [number, number] | undefined {
  const angle = frame.positionAngleDegrees * DEGREE, cos = Math.cos(angle), sin = Math.sin(angle);
  const west = (cos * dx - sin * dy) * frame.scale, north = (sin * dx + cos * dy) * frame.scale;
  const half = frame.pixels / 2, column = Math.floor(west + half), row = Math.floor(north + half);
  if (column < 0 || row < 0 || column >= frame.pixels || row >= frame.pixels) return undefined;
  return [column, row];
}

/** Distance from the grid's centre in body radii, for the stored pixel at (`column`, `row`): its centre sits at
 * `column + 0.5`, and the body stands at continuous `pixels / 2`. */
export const gridRadii = (column: number, row: number, pixels: number, bodyRadiusPixels: number) =>
  Math.hypot(column + 0.5 - pixels / 2, row + 0.5 - pixels / 2) / bodyRadiusPixels;

/** The planetographic latitude a point just off the limb stands at, for a body whose sub-observer latitude is near zero.
 * The limb is then the set of points a quarter turn from the sub-observer point, and a limb point at latitude `phi` is
 * drawn at height `sin phi` in body radii, whichever side of the body it is on. */
export function gridLatitudeDegrees(column: number, row: number, pixels: number, bodyRadiusPixels: number): number {
  const radii = gridRadii(column, row, pixels, bodyRadiusPixels);
  if (!(radii > 0)) return 0;
  return Math.asin(Math.max(-1, Math.min(1, (row + 0.5 - pixels / 2) / (radii * bodyRadiusPixels)))) / DEGREE;
}

// ---- the model the counts are compared against ----------------------------------------------------------------------
/** A polynomial surface fitted to everything outside `maskRadii`, which stands in for the smooth background the body is
 * seen against. It carries a large-scale gradient well and structure on the scale of the body not at all; what it leaves
 * behind is reported by `limbStatistics`, not hidden. */
export function backgroundSurface(values: ArrayLike<number>, pixels: number, bodyRadiusPixels: number, maskRadii: number, degree: number): Float64Array {
  if (!Number.isSafeInteger(degree) || degree < 0 || degree > 6) throw new RangeError('A background surface is fitted at degree 0 to 6.');
  const terms: [number, number][] = [];
  for (let i = 0; i <= degree; i++) for (let j = 0; i + j <= degree; j++) terms.push([i, j]);
  const half = pixels / 2;
  const basis = (x: number, y: number) => terms.map(([i, j]) => ((x - half) / half) ** i * ((y - half) / half) ** j);
  const count = terms.length, normal = Array.from({ length: count }, () => new Float64Array(count)), right = new Float64Array(count);
  let used = 0;
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
    if (gridRadii(x, y, pixels, bodyRadiusPixels) < maskRadii) continue;
    used++;
    const row = basis(x, y), value = values[y * pixels + x]!;
    for (let a = 0; a < count; a++) { right[a]! += row[a]! * value; for (let b = 0; b < count; b++) normal[a]![b]! += row[a]! * row[b]!; }
  }
  if (used < count) throw new RangeError('Fewer background pixels than the surface has terms.');
  for (let i = 0; i < count; i++) {
    let pivot = i;
    for (let r = i + 1; r < count; r++) if (Math.abs(normal[r]![i]!) > Math.abs(normal[pivot]![i]!)) pivot = r;
    [normal[i], normal[pivot]] = [normal[pivot]!, normal[i]!];
    [right[i], right[pivot]] = [right[pivot]!, right[i]!];
    if (normal[i]![i]! === 0) throw new RangeError('The background surface is not determined by these pixels.');
    for (let r = i + 1; r < count; r++) {
      const factor = normal[r]![i]! / normal[i]![i]!;
      for (let c = i; c < count; c++) normal[r]![c]! -= factor * normal[i]![c]!;
      right[r]! -= factor * right[i]!;
    }
  }
  const coefficients = new Float64Array(count);
  for (let i = count - 1; i >= 0; i--) {
    let value = right[i]!;
    for (let j = i + 1; j < count; j++) value -= normal[i]![j]! * coefficients[j]!;
    coefficients[i] = value / normal[i]![i]!;
  }
  const surface = new Float64Array(pixels * pixels);
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) surface[y * pixels + x] = basis(x, y).reduce((total, term, index) => total + term * coefficients[index]!, 0);
  return surface;
}

/** The background times the azimuthal average of what the data leave on it: the background carries the scene the body sits
 * in, the average carries the body's own silhouette and the wings of the telescope's blur around it. Rings are a hundredth
 * of a body radius wide. A pixel whose ring holds nothing, or whose background is not positive, is left not a number, and
 * the statistics skip any bin holding one. */
export function azimuthalRatio(values: ArrayLike<number>, background: ArrayLike<number>, pixels: number, bodyRadiusPixels: number, maxRadii: number): Float64Array {
  const rings = Math.ceil(maxRadii * 100), total = new Float64Array(rings), counted = new Float64Array(rings);
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
    const ring = Math.floor(gridRadii(x, y, pixels, bodyRadiusPixels) * 100), level = background[y * pixels + x]!;
    if (ring >= rings || !(level > 0)) continue;
    total[ring]! += values[y * pixels + x]! / level; counted[ring]!++;
  }
  const model = new Float64Array(pixels * pixels).fill(Number.NaN);
  for (let y = 0; y < pixels; y++) for (let x = 0; x < pixels; x++) {
    const ring = Math.floor(gridRadii(x, y, pixels, bodyRadiusPixels) * 100), level = background[y * pixels + x]!;
    if (ring >= rings || !counted[ring]! || !(level > 0)) continue;
    model[y * pixels + x] = level * (total[ring]! / counted[ring]!);
  }
  return model;
}

// ---- what the statistics come to -------------------------------------------------------------------------------------
export interface Bin { readonly column: number; readonly row: number; readonly radii: number; readonly latitudeDegrees: number; readonly z: number }
export interface Spread { readonly bins: number; readonly mean: number; readonly standardDeviation: number; readonly min: number; readonly max: number }

const spread = (values: readonly number[]): Spread => {
  if (!values.length) throw new RangeError('A spread is taken over at least one bin.');
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return { bins: values.length, mean, standardDeviation: Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length),
    min: Math.min(...values), max: Math.max(...values) };
};

/** Every square bin of `binPixels` whose centre falls between two radii, with how far its counts fall short of the model in
 * units of the Poisson noise of the counts the model expects. Positive z means light is missing, which is what absorption
 * by something in front of the body would look like. Bins are laid side by side, so they are independent of one another.
 * `values` and `model` are rates; `seconds` turns them back into the counts the noise belongs to. */
export function significanceBins(values: ArrayLike<number>, model: ArrayLike<number>, pixels: number, bodyRadiusPixels: number,
  seconds: number, binPixels: number, radii: readonly [number, number]): Bin[] {
  if (!Number.isSafeInteger(binPixels) || binPixels < 1) throw new RangeError('A bin is a whole number of pixels across.');
  if (!(seconds > 0)) throw new RangeError('Counts are collected over a positive time.');
  const bins: Bin[] = [];
  for (let y = 0; y + binPixels <= pixels; y += binPixels) for (let x = 0; x + binPixels <= pixels; x += binPixels) {
    let observed = 0, expected = 0, whole = true;
    for (let j = 0; j < binPixels && whole; j++) for (let i = 0; i < binPixels; i++) {
      const level = model[(y + j) * pixels + x + i]!;
      if (!Number.isFinite(level)) { whole = false; break; }
      observed += values[(y + j) * pixels + x + i]!; expected += level;
    }
    if (!whole || !(expected > 0)) continue;
    const column = x + (binPixels - 1) / 2, row = y + (binPixels - 1) / 2, distance = gridRadii(column, row, pixels, bodyRadiusPixels);
    if (distance < radii[0] || distance > radii[1]) continue;
    bins.push({ column, row, radii: distance, latitudeDegrees: gridLatitudeDegrees(column, row, pixels, bodyRadiusPixels),
      z: (expected - observed) * seconds / Math.sqrt(expected * seconds) });
  }
  return bins;
}

export interface SectorStatistics {
  readonly sector: string; readonly binPixels: number;
  /** Far from the body, where the model should leave pure counting noise. A standard deviation above one says the model is
   * missing structure, and every z in this image is that much larger than the departure it stands for. */
  readonly control: Spread;
  readonly annulus: Spread;
  readonly claimed: { readonly latitudeRange: readonly [number, number]; readonly bins: number; readonly darkest: Bin };
  /** The same latitude band on the other side of the equator: a body-shaped claim should not have a twin there. */
  readonly mirrored: { readonly latitudeRange: readonly [number, number]; readonly bins: number; readonly darkest: Bin };
  /** The darkest bin of the claimed band, divided by the scatter the annulus itself shows. This is the number to compare
   * with a published significance when the control scatter is not one. */
  readonly darkestOverAnnulusScatter: number;
  readonly darkestOverControlScatter: number;
}

/** What one claimed sector comes to at one bin size, with both normalisations side by side. */
export function limbStatistics(values: ArrayLike<number>, model: ArrayLike<number>, pixels: number, bodyRadiusPixels: number,
  seconds: number, sector: TimeTagSector, binPixels: number): SectorStatistics {
  const control = significanceBins(values, model, pixels, bodyRadiusPixels, seconds, binPixels, sector.controlRadii as [number, number]);
  const annulus = significanceBins(values, model, pixels, bodyRadiusPixels, seconds, binPixels, sector.annulusRadii as [number, number]);
  const [low, high] = sector.latitudeRange;
  const within = (bin: Bin, from: number, to: number) => bin.latitudeDegrees >= from && bin.latitudeDegrees <= to;
  const claimed = annulus.filter(bin => within(bin, low, high));
  const mirrored = annulus.filter(bin => within(bin, -high, -low));
  if (!claimed.length || !mirrored.length) throw new RangeError(`Sector ${sector.id} holds no bins at ${binPixels} pixels.`);
  const darkest = (bins: readonly Bin[]) => bins.reduce((best, bin) => bin.z > best.z ? bin : best);
  const controlSpread = spread(control.map(bin => bin.z)), annulusSpread = spread(annulus.map(bin => bin.z));
  const best = darkest(claimed);
  return {
    sector: sector.id, binPixels, control: controlSpread, annulus: annulusSpread,
    claimed: { latitudeRange: [low, high], bins: claimed.length, darkest: best },
    mirrored: { latitudeRange: [-high, -low], bins: mirrored.length, darkest: darkest(mirrored) },
    darkestOverAnnulusScatter: best.z / annulusSpread.standardDeviation,
    darkestOverControlScatter: best.z / controlSpread.standardDeviation,
  };
}
