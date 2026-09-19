/** One example picture per virtual telescope, made from a product the telescope's own toolkit produced.
 *
 * Every picture in docs/telescopes comes from this one renderer and from the checked-in recipe beside it (examples.json).
 * A recipe states, and this module enforces, everything that turns stored numbers into a picture: which file and which
 * extension or plane, the pixel window, the unit those numbers are in, the two values drawn as black and white, the
 * stretch between them, which way up the picture is, the whole-number enlargement, and the colours. Nothing is smoothed,
 * sharpened, interpolated, denoised or normalised: every source sample becomes a square block of equal output pixels, and
 * a sample outside the stated range is clipped, not rescaled.
 *
 * The recipe also pins the product: its sha256, the command that made it, and the program or definition file that command
 * reads. A reader re-runs that command, gets the same product, and re-runs this renderer to get the same picture.
 *
 * Three product shapes are read, and no more: a FITS image (any extension, and a plane of a cube), a FITS event list
 * binned to counts per square bin, and a JunoCam PDS3 push-frame image as the instrument records it.
 *
 * Related: ../content/fits-gallery-image.mts, whose rules for sky images this follows (north up, east left, every source
 * pixel a square). */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { fitsImageAccessor, imageExtent, readFitsFileHdus, readFitsFileRegion, readFitsHdus, type FitsHeader } from '../../fits.mts';
import { skyDisplayRaster, skyImageAxes, skyProjection } from '../../fits-sky.mts';
import { column, eventTable } from '../chandra/events.mts';
import { decodeJunocam } from '../terrestrial-layers/junocam.mts';

/** An enlarged picture stays small enough to read in a document and to commit beside it. */
const MAX_OUTPUT_EDGE = 1024;
/** A window bounds what is decoded, so a recipe cannot ask for a mosaic-sized allocation. */
const MAX_WINDOW_SAMPLES = 4_000_000;

export type ExampleSource =
  /** One extension of a FITS file; `plane` selects a plane of a cube, counted from 1, and `planes` sums that many
   * consecutive planes from it. A sum is an addition, not a smoothing: no sample is moved or interpolated. */
  | { readonly kind: 'fits-image'; readonly path: string; readonly extension: number; readonly plane: number; readonly planes: number }
  /** A FITS event list binned to counts per square bin: `binPixels` column units on a side, the first bin's lower-left
   * corner at `origin` in those same column units, and `size` bins across and up. `band`, when stated, keeps only the
   * events whose value in that column lies between its two limits, which is how an energy band is selected. */
  | { readonly kind: 'fits-events'; readonly path: string; readonly columns: readonly [string, string];
      readonly binPixels: number; readonly origin: readonly [number, number]; readonly size: readonly [number, number];
      readonly band: { readonly column: string; readonly limits: readonly [number, number] } | undefined }
  /** A JunoCam PDS3 image with its label, in the reflectance the RDR records. */
  | { readonly kind: 'junocam-image'; readonly path: string; readonly labelPath: string };

export type ExampleColour =
  | { readonly kind: 'greys'; readonly missing?: string }
  /** A stated ramp: stops at positions 0 to 1 through the stretched range, interpolated in sRGB. */
  | { readonly kind: 'ramp'; readonly stops: readonly (readonly [number, string])[]; readonly missing?: string };

export interface ExampleRecipe {
  readonly id: string;
  readonly telescope: string;
  readonly instrument: string;
  readonly title: string;
  readonly target: string;
  readonly date: string;
  readonly source: ExampleSource;
  /** Every source path is where the command writes it inside the repository it runs in. A toolkit that lives in a sibling
   * worktree on this machine names that directory here, and the product is read from beside this checkout. */
  readonly producedIn: string | undefined;
  /** The unit the stored numbers are in. A product that states BUNIT must state this one. */
  readonly unit: string;
  /** First column and first stored row, counted from 1 as FITS viewers do, and the size in source samples. */
  readonly window: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** `sky` reads the WCS and draws north up and east left; the other two state which stored row is drawn at the top. */
  readonly orientation: { readonly mode: 'sky' | 'first-row-top' | 'first-row-bottom'; readonly note: string };
  /** `black` and `white` are in `unit`. `asinh` needs `softening`, also in `unit`: the width of the linear part. */
  readonly stretch: { readonly kind: 'linear' | 'asinh'; readonly black: number; readonly white: number; readonly softening?: number };
  readonly colour: ExampleColour;
  /** Output pixels per source sample, across and down. The two differ only where the instrument's samples are not
   * square on the sky, and a rectangle of equal pixels is still a block of equal pixels. */
  readonly enlarge: readonly [number, number];
  readonly product: { readonly sha256: string; readonly command: string; readonly definition: string };
  readonly note: string;
}

const RGB = /^#[0-9a-f]{6}$/u;
const whole = (value: unknown, label: string, minimum = 1) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new TypeError(`Example ${label} must be a whole number from ${minimum}.`);
  return value;
};
const finite = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`Example ${label} must be a finite number.`);
  return value;
};
const nonEmpty = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`Example ${label} must be a non-empty string.`);
  return value.trim();
};
const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Example ${label} must be an object.`);
  return value as Record<string, unknown>;
};
function colourValue(value: unknown, label: string) {
  const text = nonEmpty(value, label).toLowerCase();
  if (!RGB.test(text)) throw new TypeError(`Example ${label} must be an #rrggbb colour.`);
  return text;
}

function parseSource(value: unknown): ExampleSource {
  const source = record(value, 'source'), kind = nonEmpty(source.kind, 'source.kind'), path = nonEmpty(source.path, 'source.path');
  if (kind === 'fits-image') return { kind, path, extension: whole(source.extension, 'source.extension', 0),
    plane: whole(source.plane, 'source.plane'), planes: source.planes === undefined ? 1 : whole(source.planes, 'source.planes') };
  if (kind === 'fits-events') {
    const columns = source.columns, origin = source.origin, size = source.size;
    if (!Array.isArray(columns) || columns.length !== 2) throw new TypeError('Example source.columns names the two event columns to bin.');
    if (!Array.isArray(origin) || origin.length !== 2 || !Array.isArray(size) || size.length !== 2) throw new TypeError('Example source.origin and source.size are two numbers each.');
    const bins = [whole(size[0], 'source.size[0]'), whole(size[1], 'source.size[1]')] as const;
    if (bins[0] * bins[1] > MAX_WINDOW_SAMPLES) throw new RangeError('An event picture asks for too many bins.');
    let band: Extract<ExampleSource, { kind: 'fits-events' }>['band'];
    if (source.band !== undefined) {
      const stated = record(source.band, 'source.band'), limits = stated.limits;
      if (!Array.isArray(limits) || limits.length !== 2) throw new TypeError('An event band states two limits.');
      const [low, high] = [finite(limits[0], 'source.band.limits[0]'), finite(limits[1], 'source.band.limits[1]')];
      if (!(low < high)) throw new TypeError('An event band runs from its lower limit up.');
      band = { column: nonEmpty(stated.column, 'source.band.column'), limits: [low, high] };
    }
    return { kind, path, columns: [nonEmpty(columns[0], 'source.columns[0]'), nonEmpty(columns[1], 'source.columns[1]')],
      binPixels: whole(source.binPixels, 'source.binPixels'), origin: [finite(origin[0], 'source.origin[0]'), finite(origin[1], 'source.origin[1]')], size: bins, band };
  }
  if (kind === 'junocam-image') return { kind, path, labelPath: nonEmpty(source.labelPath, 'source.labelPath') };
  throw new TypeError(`Unsupported example source kind: ${kind}.`);
}

function parseColour(value: unknown): ExampleColour {
  const colour = record(value, 'colour'), kind = nonEmpty(colour.kind, 'colour.kind');
  const missing = colour.missing === undefined ? undefined : colourValue(colour.missing, 'colour.missing');
  if (kind === 'greys') return { kind, ...(missing === undefined ? {} : { missing }) };
  if (kind !== 'ramp') throw new TypeError(`Unsupported example colour kind: ${kind}.`);
  const stops = colour.stops;
  if (!Array.isArray(stops) || stops.length < 2) throw new TypeError('Example colour.stops needs at least two stops.');
  const parsed = stops.map((stop, index) => {
    if (!Array.isArray(stop) || stop.length !== 2) throw new TypeError('Example colour stop is a position and an #rrggbb colour.');
    const at = finite(stop[0], `colour.stops[${index}][0]`);
    if (at < 0 || at > 1) throw new RangeError('Example colour stop positions run from 0 to 1.');
    return [at, colourValue(stop[1], `colour.stops[${index}][1]`)] as const;
  });
  if (parsed[0]![0] !== 0 || parsed.at(-1)![0] !== 1 || parsed.some((stop, index) => index > 0 && stop[0] <= parsed[index - 1]![0]))
    throw new TypeError('Example colour stops rise from 0 to 1.');
  return { kind, stops: parsed, ...(missing === undefined ? {} : { missing }) };
}

export function parseExampleRecipe(value: unknown): ExampleRecipe {
  const recipe = record(value, 'recipe'), window = record(recipe.window, 'window'), orientation = record(recipe.orientation, 'orientation');
  const stretch = record(recipe.stretch, 'stretch'), product = record(recipe.product, 'product');
  const id = nonEmpty(recipe.id, 'id');
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) throw new TypeError('An example id is lower-case letters, digits and hyphens.');
  const size = { x: whole(window.x, 'window.x'), y: whole(window.y, 'window.y'), width: whole(window.width, 'window.width'), height: whole(window.height, 'window.height') };
  const stated = recipe.enlarge;
  if (Array.isArray(stated) && stated.length !== 2) throw new TypeError('An example enlargement is one whole number, or one across and one down.');
  const enlarge: [number, number] = Array.isArray(stated) ? [whole(stated[0], 'enlarge[0]'), whole(stated[1], 'enlarge[1]')] : [whole(stated, 'enlarge'), whole(stated, 'enlarge')];
  if (size.width * size.height > MAX_WINDOW_SAMPLES) throw new RangeError('An example window asks for too many samples.');
  if (size.width * enlarge[0] > MAX_OUTPUT_EDGE || size.height * enlarge[1] > MAX_OUTPUT_EDGE) throw new RangeError(`An example picture is larger than ${MAX_OUTPUT_EDGE} pixels on an edge.`);
  const mode = nonEmpty(orientation.mode, 'orientation.mode');
  if (mode !== 'sky' && mode !== 'first-row-top' && mode !== 'first-row-bottom') throw new TypeError(`Unsupported example orientation: ${mode}.`);
  const kind = nonEmpty(stretch.kind, 'stretch.kind');
  if (kind !== 'linear' && kind !== 'asinh') throw new TypeError(`Unsupported example stretch: ${kind}.`);
  const [black, white] = [finite(stretch.black, 'stretch.black'), finite(stretch.white, 'stretch.white')];
  if (!(black < white)) throw new TypeError('An example stretch runs from black up to white.');
  const softening = stretch.softening === undefined ? undefined : finite(stretch.softening, 'stretch.softening');
  if ((kind === 'asinh') !== (softening !== undefined) || (softening !== undefined && !(softening > 0)))
    throw new TypeError('An asinh stretch states a positive softening, in the image unit; a linear stretch states none.');
  const sha256 = nonEmpty(product.sha256, 'product.sha256').toLowerCase();
  if (!/^[0-9a-f]{64}$/u.test(sha256)) throw new TypeError('An example product sha256 is 64 hexadecimal characters.');
  return {
    id, telescope: nonEmpty(recipe.telescope, 'telescope'), instrument: nonEmpty(recipe.instrument, 'instrument'),
    title: nonEmpty(recipe.title, 'title'), target: nonEmpty(recipe.target, 'target'), date: nonEmpty(recipe.date, 'date'),
    source: parseSource(recipe.source), producedIn: recipe.producedIn === undefined ? undefined : nonEmpty(recipe.producedIn, 'producedIn'),
    unit: nonEmpty(recipe.unit, 'unit'), window: size,
    orientation: { mode, note: nonEmpty(orientation.note, 'orientation.note') },
    stretch: { kind, black, white, ...(softening === undefined ? {} : { softening }) },
    colour: parseColour(recipe.colour), enlarge,
    product: { sha256, command: nonEmpty(product.command, 'product.command'), definition: nonEmpty(product.definition, 'product.definition') },
    note: nonEmpty(recipe.note, 'note'),
  };
}

export function parseExampleRecipes(value: unknown): ExampleRecipe[] {
  const file = record(value, 'file');
  if (file.schema !== 'cssearth-telescope-examples@1') throw new TypeError('An examples file states schema cssearth-telescope-examples@1.');
  const examples = file.examples;
  if (!Array.isArray(examples) || !examples.length) throw new TypeError('An examples file lists at least one example.');
  const parsed = examples.map(parseExampleRecipe);
  if (new Set(parsed.map(example => example.id)).size !== parsed.length) throw new TypeError('Example ids repeat.');
  return parsed;
}

/** A read window of source samples, in the product's own storage order: the first stored row first. */
export interface SourceWindow { readonly values: Float64Array; readonly width: number; readonly height: number; readonly header: FitsHeader | undefined }

/** Counts per square bin, the first row the lowest in the second column's value. Events outside the grid, and events
 * outside the stated band, are dropped. */
export function binEventCounts(x: Float64Array, y: Float64Array, source: Extract<ExampleSource, { kind: 'fits-events' }>, band?: Float64Array) {
  if (x.length !== y.length || (band && band.length !== x.length)) throw new Error('Event columns differ in length.');
  const [width, height] = source.size, [x0, y0] = source.origin, counts = new Float64Array(width * height);
  const [low, high] = source.band?.limits ?? [-Infinity, Infinity];
  for (let index = 0; index < x.length; index++) {
    if (band && !(band[index]! >= low && band[index]! <= high)) continue;
    const column = Math.floor((x[index]! - x0) / source.binPixels), row = Math.floor((y[index]! - y0) / source.binPixels);
    if (column >= 0 && column < width && row >= 0 && row < height) counts[row * width + column]! += 1;
  }
  return { values: counts, width, height };
}

/** A product path inside this checkout, or inside the sibling worktree the toolkit ran in. */
export function productPath(recipe: Pick<ExampleRecipe, 'producedIn'>, path: string, root: string) {
  const here = resolve(root, path);
  if (existsSync(here) || !recipe.producedIn) return here;
  return resolve(root, '..', recipe.producedIn, path);
}

async function readSourceWindow(recipe: ExampleRecipe, root: string): Promise<SourceWindow> {
  const { source, window } = recipe, path = productPath(recipe, source.path, root);
  if (source.kind === 'fits-events') {
    const bytes = await readFile(path), table = eventTable(bytes);
    const binned = binEventCounts(column(bytes, table, source.columns[0]), column(bytes, table, source.columns[1]), source,
      source.band ? column(bytes, table, source.band.column) : undefined);
    return { ...crop(binned.values, binned.width, binned.height, window), header: table.hdu.header };
  }
  if (source.kind === 'junocam-image') {
    const image = decodeJunocam(await readFile(path), await readFile(productPath(recipe, source.labelPath, root), 'latin1'));
    return { ...crop(Float64Array.from(image.values), image.width, image.height, window), header: undefined };
  }
  const hdus = await readFitsFileHdus(path), hdu = hdus[source.extension];
  if (!hdu) throw new RangeError(`The product has no extension ${source.extension}.`);
  const extent = imageExtent(hdu.dimensions);
  if (!extent) throw new Error('An example FITS image needs two or three sky axes, with any further axes degenerate.');
  const [width, height, planes = 1] = extent;
  if (source.plane + source.planes - 1 > planes) throw new RangeError(`The product holds ${planes} plane(s); the recipe asks for ${source.planes} from plane ${source.plane}.`);
  if (window.x - 1 + window.width > width! || window.y - 1 + window.height > height!) throw new RangeError('An example window leaves the image.');
  if (extent.length === 2 && source.plane === 1 && source.planes === 1) {
    const region = await readFitsFileRegion(path, hdu, { x0: window.x - 1, y0: window.y - 1, width: window.width, height: window.height });
    return { values: region.values, width: window.width, height: window.height, header: hdu.header };
  }
  const bytes = await readFile(path), at = fitsImageAccessor(bytes, readFitsHdus(bytes)[source.extension]!);
  const values = new Float64Array(window.width * window.height);
  for (let index = 0; index < source.planes; index++) {
    const plane = (source.plane - 1 + index) * width! * height!;
    for (let row = 0; row < window.height; row++)
      for (let x = 0; x < window.width; x++) values[row * window.width + x]! += at(plane + (window.y - 1 + row) * width! + window.x - 1 + x);
  }
  return { values, width: window.width, height: window.height, header: hdu.header };
}

function crop(values: Float64Array, width: number, height: number, window: ExampleRecipe['window']) {
  if (window.x - 1 + window.width > width || window.y - 1 + window.height > height) throw new RangeError('An example window leaves the image.');
  const out = new Float64Array(window.width * window.height);
  for (let row = 0; row < window.height; row++)
    out.set(values.subarray((window.y - 1 + row) * width + window.x - 1, (window.y - 1 + row) * width + window.x - 1 + window.width), row * window.width);
  return { values: out, width: window.width, height: window.height };
}

/** Samples in display order. `sky` reads the WCS; `first-row-bottom` is the usual FITS display, the first stored row lowest. */
export function displayOrder(source: SourceWindow, recipe: ExampleRecipe): Float64Array {
  const { values, width, height } = source;
  if (recipe.orientation.mode === 'sky') {
    if (!source.header) throw new Error('A sky orientation needs a FITS header.');
    return skyDisplayRaster(values, width, height, skyImageAxes(source.header));
  }
  if (recipe.orientation.mode === 'first-row-top') return values;
  return skyDisplayRaster(values, width, height, { eastRight: false, northUp: true });
}

/** Where north and east point in the finished picture, in degrees clockwise from up, measured from the product's own
 * gnomonic WCS rather than asserted. Only a TAN image has one to measure; a picture drawn `sky` needs no measurement,
 * because that mode is refused unless the image is already north up and east left. */
export function northAndEastOnScreen(header: FitsHeader, mode: ExampleRecipe['orientation']['mode'], at: readonly [number, number]) {
  if (mode === 'sky') return { northDegrees: 0, eastDegrees: 270 };
  const projection = skyProjection(header), [x, y] = at, [ra, dec] = projection.skyOf(x, y);
  const step = 10 * projection.scaleArcsec / 3600;
  const screen = (target: [number, number] | undefined) => {
    if (!target) throw new Error('A direction leaves the tangent plane.');
    const dx = target[0] - x, up = (mode === 'first-row-bottom' ? 1 : -1) * (target[1] - y);
    return (Math.atan2(dx, up) * 180 / Math.PI + 360) % 360;
  };
  return { northDegrees: screen(projection.pixelOf(ra, dec + step)), eastDegrees: screen(projection.pixelOf(ra + step / Math.cos(dec * Math.PI / 180), dec)) };
}

/** The stretched position of a sample between black and white, clipped to 0 and 1; NaN stays NaN. */
export function stretchSample(value: number, stretch: ExampleRecipe['stretch']) {
  if (!Number.isFinite(value)) return NaN;
  const span = stretch.white - stretch.black;
  const fraction = stretch.kind === 'linear' ? (value - stretch.black) / span
    : Math.asinh((value - stretch.black) / stretch.softening!) / Math.asinh(span / stretch.softening!);
  return Math.min(1, Math.max(0, fraction));
}

const channels = (colour: string) => [1, 3, 5].map(at => Number.parseInt(colour.slice(at, at + 2), 16)) as [number, number, number];

/** Red, green and blue for a stretched position, or for a missing sample. */
export function colourOf(fraction: number, colour: ExampleColour): [number, number, number] {
  if (!Number.isFinite(fraction)) {
    if (!colour.missing) throw new Error('A sample has no value and the recipe states no colour for missing samples.');
    return channels(colour.missing);
  }
  if (colour.kind === 'greys') { const grey = Math.round(255 * fraction); return [grey, grey, grey]; }
  const stops = colour.stops, next = stops.findIndex(stop => stop[0] >= fraction);
  if (next <= 0) return channels(stops[Math.max(next, 0)]![1]);
  const [aAt, aColour] = stops[next - 1]!, [bAt, bColour] = stops[next]!, t = (fraction - aAt) / (bAt - aAt);
  const [a, b] = [channels(aColour), channels(bColour)];
  return [0, 1, 2].map(index => Math.round(a[index]! + t * (b[index]! - a[index]!))) as [number, number, number];
}

/** Display-ordered red, green and blue samples, before enlargement. */
export function examplePixels(source: SourceWindow, recipe: ExampleRecipe) {
  if (source.header && typeof source.header.BUNIT === 'string' && source.header.BUNIT.trim() !== recipe.unit)
    throw new Error(`The product states BUNIT ${source.header.BUNIT.trim()}; the recipe states ${recipe.unit}.`);
  const display = displayOrder(source, recipe), pixels = new Uint8Array(display.length * 3);
  for (let index = 0; index < display.length; index++) pixels.set(colourOf(stretchSample(display[index]!, recipe.stretch), recipe.colour), index * 3);
  return { pixels, width: source.width, height: source.height };
}

/** The picture: every source sample a block of `enlarge` equal pixels, written as a lossless WebP. */
export async function renderExamplePicture(source: SourceWindow, recipe: ExampleRecipe) {
  const { pixels, width, height } = examplePixels(source, recipe), [across, down] = recipe.enlarge;
  const [outWidth, outHeight] = [width * across, height * down], out = new Uint8Array(outWidth * outHeight * 3);
  for (let row = 0; row < outHeight; row++) {
    const line = Math.floor(row / down) * width;
    for (let x = 0; x < outWidth; x++) out.set(pixels.subarray((line + Math.floor(x / across)) * 3, (line + Math.floor(x / across)) * 3 + 3), (row * outWidth + x) * 3);
  }
  const bytes = await sharp(out, { raw: { width: outWidth, height: outHeight, channels: 3 } }).webp({ lossless: true, effort: 6 }).toBuffer();
  return { bytes, width: outWidth, height: outHeight };
}

/** Read the product the recipe pins, checking its sha256, and draw the picture. */
export async function makeExamplePicture(recipe: ExampleRecipe, root: string) {
  const digest = createHash('sha256').update(await readFile(productPath(recipe, recipe.source.path, root))).digest('hex');
  if (digest !== recipe.product.sha256)
    throw new Error(`${recipe.id}: ${recipe.source.path} hashes to ${digest}; the recipe pins ${recipe.product.sha256}. Re-make the product with: ${recipe.product.command}`);
  const source = await readSourceWindow(recipe, root);
  return { ...await renderExamplePicture(source, recipe), header: source.header };
}

if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const repository = resolve(import.meta.dirname, '../../..');
  const only = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
  const recipes = parseExampleRecipes(JSON.parse(await readFile(resolve(import.meta.dirname, 'examples.json'), 'utf8')));
  const directory = resolve(repository, 'docs/telescopes');
  await mkdir(directory, { recursive: true });
  for (const recipe of recipes.filter(recipe => !only.length || only.includes(recipe.id))) {
    const picture = await makeExamplePicture(recipe, repository);
    await writeFile(resolve(directory, `${recipe.id}.webp`), picture.bytes);
    let directions = '';
    if (picture.header && String(picture.header.CTYPE1 ?? '') === 'RA---TAN') {
      const centre: [number, number] = [recipe.window.x - 1 + recipe.window.width / 2, recipe.window.y - 1 + recipe.window.height / 2];
      const { northDegrees, eastDegrees } = northAndEastOnScreen(picture.header, recipe.orientation.mode, centre);
      directions = `, north ${northDegrees.toFixed(1)}° and east ${eastDegrees.toFixed(1)}° clockwise from up`;
    }
    console.log(`${recipe.id}: ${picture.width}x${picture.height}, ${(picture.bytes.length / 1024).toFixed(1)} KiB, ${recipe.telescope} ${recipe.instrument}${directions}`);
  }
}
