/**
 * The comparison a ground-based photograph lens ships on: our cameras against the paper that published the frames.
 *
 * The survey papers register a shape model by fitting it to the frames and show the result as a figure: the photographs
 * in one row and the model rendered at each epoch in the rows below, with the spin axis drawn. That figure is the
 * field's evidence, and reproducing it is ours. This module reads such a figure from the pinned paper, finds its panels,
 * and measures how our cameras, which place the lens, reproduce it: the model's outline at each epoch over a full turn of
 * rotational phase, the spin axis on the sky, and the photographs' own outlines in native pixels over a phase sweep.
 * Every number is reported; none of them is a gate. The lens's observer-cameras record names the result.
 */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';

export const COMPARISON_SPEC_SCHEMA = 'cssearth-published-comparison@1';
export const COMPARISON_EVIDENCE_SCHEMA = 'cssearth-published-comparison-evidence@1';
export const COMPARISON_SPEC_FILE = 'preparation/published-comparison.json';

/** A figure column: its printed label, the lens frame it shows or null, and the dark band it sits in, counted from the top (0 when the figure has one). */
export interface ComparisonColumn { label: string; frame: string | null; band: number }
export interface ComparisonSpec {
  schema: string; lensId: string; source: string; figure: string;
  /** The figure as an image object of a pinned paper: the manifest input, the object number and the decoded pixels' identity. */
  document: { input: string; object: number; width: number; height: number; sha256: string };
  /** The rows of photographs and of the model the lens rides, counted from the top of the figure's dark band, and how many image rows the band holds. */
  rows: { image: number; model: number; count: number };
  /** One entry per figure column, band by band and left to right within a band: its printed label and the lens frame it shows, or null for an epoch the lens does not use. A figure with more epochs than fit one band continues them in a second band below. */
  columns: ComparisonColumn[];
}

export function parseComparisonSpec(value: unknown): ComparisonSpec {
  const record = requireRecord(value, 'published comparison');
  if (record.schema !== COMPARISON_SPEC_SCHEMA) throw new TypeError(`A published comparison states schema ${COMPARISON_SPEC_SCHEMA}.`);
  const source = requireString(record.source, 'source');
  if (!/^https:\/\/doi\.org\/10\.\S+$/u.test(source)) throw new TypeError('A published comparison names its paper by DOI URL.');
  const document = requireRecord(record.document, 'document'), rows = requireRecord(record.rows, 'rows');
  const integer = (value: unknown, at: string) => { const n = requireFiniteNumber(value, at); if (!Number.isSafeInteger(n) || n < 0) throw new TypeError(`${at} is a whole number.`); return n; };
  const sha256 = requireString(document.sha256, 'document sha256');
  if (!/^[0-9a-f]{64}$/u.test(sha256)) throw new TypeError('The figure pixels are pinned by a SHA-256 digest.');
  const spec: ComparisonSpec = {
    schema: COMPARISON_SPEC_SCHEMA, lensId: requireString(record.lensId, 'lensId'), source, figure: requireString(record.figure, 'figure'),
    document: { input: requireString(document.input, 'document input'), object: integer(document.object, 'document object'), width: integer(document.width, 'figure width'), height: integer(document.height, 'figure height'), sha256 },
    rows: { image: integer(rows.image, 'image row'), model: integer(rows.model, 'model row'), count: integer(rows.count, 'row count') },
    columns: requireArray(record.columns, 'columns').map((value, index) => {
      const column = requireRecord(value, `column ${index}`);
      return { label: requireString(column.label, `column ${index} label`), frame: column.frame === null ? null : requireString(column.frame, `column ${index} frame`),
        band: column.band === undefined ? 0 : integer(column.band, `column ${index} band`) };
    }),
  };
  if (spec.rows.image >= spec.rows.count || spec.rows.model >= spec.rows.count || spec.rows.image === spec.rows.model) throw new TypeError('The photograph and model rows are distinct rows of the figure.');
  if (!spec.columns.some(column => column.frame !== null)) throw new TypeError('At least one figure column shows a lens frame.');
  if (spec.columns.some((column, index) => index > 0 && column.band < spec.columns[index - 1].band)) throw new TypeError('Figure columns are listed band by band, top band first.');
  return spec;
}

/** An image as the comparison reads it: interleaved channels, top row first. */
export interface Raster { width: number; height: number; channels: number; data: ArrayLike<number> }
export interface Mask { width: number; height: number; data: Uint8Array }
export interface Box { x0: number; y0: number; x1: number; y1: number }

const pixel = (image: Raster, x: number, y: number, channel: number) => image.data[(y * image.width + x) * image.channels + Math.min(channel, image.channels - 1)];

/** The figure's dark bands of photographs and model renderings, top to bottom. A band is the bounding box of a connected
 * region of near-black pixels, the panels' shared background around which the bodies, labels and arrows sit as islands,
 * at least a quarter the size of the largest; a dark caption mark or colour bar is far smaller. */
export function figureBands(figure: Raster): Box[] {
  const { width, height } = figure, dark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) dark[y * width + x] = +(Math.max(pixel(figure, x, y, 0), pixel(figure, x, y, 1), pixel(figure, x, y, 2)) < 16);
  const { label, sizes } = components(dark, width, height), largest = Math.max(...sizes.slice(1));
  const boxes = new Map<number, Box>();
  for (let i = 0; i < label.length; i++) {
    if (!label[i] || sizes[label[i]] * 4 < largest) continue;
    const x = i % width, y = (i - x) / width, box = boxes.get(label[i]);
    if (box) { box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x + 1); box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y + 1); }
    else boxes.set(label[i], { x0: x, x1: x + 1, y0: y, y1: y + 1 });
  }
  return [...boxes.values()].sort((a, b) => a.y0 - b.y0);
}

/** One dark band split evenly into its rows and columns. */
export function figureCells(figure: Raster, rows: number, columns: number, band = 0): Box[][] {
  const bands = figureBands(figure);
  if (band >= bands.length) throw new TypeError(`The figure has ${bands.length} dark band${bands.length === 1 ? '' : 's'}; band ${band} does not exist.`);
  const { x0, y0, x1, y1 } = bands[band];
  if (y1 - y0 < rows * 20 || x1 - x0 < columns * 20) throw new TypeError('The figure has no dark band large enough to hold its panels.');
  return Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => ({
    x0: Math.round(x0 + (x1 - x0) * c / columns), x1: Math.round(x0 + (x1 - x0) * (c + 1) / columns),
    y0: Math.round(y0 + (y1 - y0) * r / rows), y1: Math.round(y0 + (y1 - y0) * (r + 1) / rows) })));
}

/** The panel a spec column shows in a figure row: its band split into that band's columns. */
export function columnCells(figure: Raster, spec: Pick<ComparisonSpec, 'rows' | 'columns'>) {
  const bands = new Map<number, Box[][]>();
  for (const band of new Set(spec.columns.map(column => column.band))) bands.set(band, figureCells(figure, spec.rows.count, spec.columns.filter(column => column.band === band).length, band));
  return (row: number, index: number) => {
    const { band } = spec.columns[index], position = spec.columns.slice(0, index).filter(column => column.band === band).length;
    return bands.get(band)![row][position];
  };
}

const isRed = (image: Raster, x: number, y: number) => pixel(image, x, y, 0) > 150 && pixel(image, x, y, 1) < 110 && pixel(image, x, y, 2) < 110;

function components(mask: Uint8Array, width: number, height: number) {
  const label = new Int32Array(width * height), sizes: number[] = [0], stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || label[i]) continue;
    const id = sizes.length; sizes.push(0); stack.push(i); label[i] = id;
    while (stack.length) {
      const j = stack.pop()!; sizes[id]++;
      const x = j % width, y = (j - x) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = ny * width + nx;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[k] && !label[k]) { label[k] = id; stack.push(k); }
      }
    }
  }
  return { label, sizes };
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number, keep: 0 | 1) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let v = keep === 1 ? 0 : 1;
    for (let dy = -radius; dy <= radius && v !== keep; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy, inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
      if (keep === 1 ? inside && mask[ny * width + nx] : !inside || !mask[ny * width + nx]) { v = keep; break; }
    }
    out[y * width + x] = v;
  }
  return out;
}

/** The body in one panel: its largest bright region with the red axis arrows removed and the thin gap they leave closed, holes filled. */
export function panelDisc(figure: Raster, box: Box, threshold = 40): Mask {
  const width = box.x1 - box.x0, height = box.y1 - box.y0, bright = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const X = box.x0 + x, Y = box.y0 + y, gray = (pixel(figure, X, Y, 0) + pixel(figure, X, Y, 1) + pixel(figure, X, Y, 2)) / 3;
    bright[y * width + x] = +(gray > threshold && !isRed(figure, X, Y));
  }
  const closed = dilate(dilate(bright, width, height, 2, 1), width, height, 2, 0);
  const { label, sizes } = components(closed, width, height);
  const largest = sizes.indexOf(Math.max(...sizes.slice(1)));
  const body = new Uint8Array(width * height); for (let i = 0; i < body.length; i++) body[i] = +(label[i] === largest);
  // Fill holes: whatever is not body and not reachable from the panel edge.
  const outside = new Uint8Array(width * height), stack: number[] = [];
  for (let i = 0; i < body.length; i++) { const x = i % width, y = (i - x) / width; if (!body[i] && (x === 0 || y === 0 || x === width - 1 || y === height - 1)) { outside[i] = 1; stack.push(i); } }
  while (stack.length) { const j = stack.pop()!, x = j % width, y = (j - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * width + nx; if (nx >= 0 && ny >= 0 && nx < width && ny < height && !body[k] && !outside[k]) { outside[k] = 1; stack.push(k); } } }
  for (let i = 0; i < body.length; i++) body[i] = +!outside[i];
  return { width, height, data: body };
}

/** The spin axis a panel draws, as the angle of its red pixels' principal direction, degrees counter-clockwise from image right, in [0, 180). */
export function panelAxisDegrees(figure: Raster, box: Box): number | null {
  let n = 0, sx = 0, sy = 0; const points: [number, number][] = [];
  for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) if (isRed(figure, x, y)) { points.push([x, -y]); sx += x; sy += -y; n++; }
  if (n < 20) return null;
  const mx = sx / n, my = sy / n; let xx = 0, xy = 0, yy = 0;
  for (const [x, y] of points) { xx += (x - mx) ** 2; xy += (x - mx) * (y - my); yy += (y - my) ** 2; }
  return ((0.5 * Math.atan2(2 * xy, xx - yy)) * 180 / Math.PI + 180) % 180;
}

/** A mask resampled so its area is that of a circle of the given radius, centred on its centroid, on a square canvas. */
export function normalisedMask(mask: Mask, radius = 60, size = 200): Uint8Array {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) { n++; sx += i % mask.width; sy += Math.floor(i / mask.width); }
  if (!n) throw new TypeError('An empty outline cannot be compared.');
  const cx = sx / n, cy = sy / n, scale = Math.sqrt(n / Math.PI) / radius, out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const X = Math.round(cx + (x + 0.5 - size / 2) * scale - 0.5), Y = Math.round(cy + (y + 0.5 - size / 2) * scale - 0.5);
    out[y * size + x] = X >= 0 && Y >= 0 && X < mask.width && Y < mask.height ? mask.data[Y * mask.width + X] : 0;
  }
  return out;
}

/** Scale-free outline overlap: intersection over union of the two outlines normalised to one area and centroid. */
export function outlineOverlap(a: Mask, b: Mask) {
  const na = normalisedMask(a), nb = normalisedMask(b); let inter = 0, union = 0;
  for (let i = 0; i < na.length; i++) { inter += na[i] & nb[i]; union += na[i] | nb[i]; }
  return inter / union;
}

/** The difference between two axis angles, folded to (-90, 90]. */
export const axisDifferenceDegrees = (a: number, b: number) => { const d = ((a - b) % 180 + 180) % 180; return d > 90 ? d - 180 : d; };
