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
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

export const COMPARISON_SPEC_SCHEMA = 'cssearth-published-comparison@1';
export const COMPARISON_EVIDENCE_SCHEMA = 'cssearth-published-comparison-evidence@1';
export const COMPARISON_SPEC_FILE = 'preparation/published-comparison.json';

/** A figure column: its printed label, the lens frame it shows or null, and the dark band it sits in, counted from the top (0 when the figure has one). */
export interface ComparisonColumn { label: string; frame: string | null; band: number }
export interface ComparisonSpec {
  schema: string; lensId: string; source: string; figure: string;
  /** The figure as an image object of the paper: the paper's address, the object number and the figure's size. The paper is
   * cited, not retained; the measurement reads it from this address. */
  document: { url: string; object: number; width: number; height: number };
  /** The rows of photographs and of the model the lens rides, counted from the top of the figure's dark band, how many image rows the
   * band holds, and how many lines of text each photograph panel prints at its top, which the body's outline leaves out. */
  rows: { image: number; model: number; count: number; labelLines: number };
  /** One entry per figure column, band by band and left to right within a band: its printed label and the lens frame it shows, or null for an epoch the lens does not use. A figure with more epochs than fit one band continues them in a second band below. */
  columns: ComparisonColumn[];
}

function paperUrl(value: unknown) {
  const url = requireString(value, 'document url');
  if (!/^https:\/\/\S+\.pdf$/u.test(url)) throw new TypeError(`A published comparison reads its figure from the paper's PDF address, not ${url}.`);
  return url;
}

export function parseComparisonSpec(value: unknown): ComparisonSpec {
  const record = requireRecord(value, 'published comparison');
  if (record.schema !== COMPARISON_SPEC_SCHEMA) throw new TypeError(`A published comparison states schema ${COMPARISON_SPEC_SCHEMA}.`);
  const source = requireString(record.source, 'source');
  if (!/^https:\/\/doi\.org\/10\.\S+$/u.test(source)) throw new TypeError('A published comparison names its paper by DOI URL.');
  const document = requireRecord(record.document, 'document'), rows = requireRecord(record.rows, 'rows');
  const integer = (value: unknown, at: string) => { const n = requireFiniteNumber(value, at); if (!Number.isSafeInteger(n) || n < 0) throw new TypeError(`${at} is a whole number.`); return n; };
  const spec: ComparisonSpec = {
    schema: COMPARISON_SPEC_SCHEMA, lensId: requireString(record.lensId, 'lensId'), source, figure: requireString(record.figure, 'figure'),
    document: { url: paperUrl(document.url), object: integer(document.object, 'document object'), width: integer(document.width, 'figure width'), height: integer(document.height, 'figure height') },
    rows: { image: integer(rows.image, 'image row'), model: integer(rows.model, 'model row'), count: integer(rows.count, 'row count'),
      labelLines: rows.labelLines === undefined ? 0 : integer(rows.labelLines, 'label lines') },
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

/** The figures' spin-axis arrows are the only coloured ink on grey panels, so red is any pixel whose red channel clearly
 * leads the other two, including the arrow's darker anti-aliased fringe. */
const isRed = (image: Raster, x: number, y: number) => { const r = pixel(image, x, y, 0), g = pixel(image, x, y, 1), b = pixel(image, x, y, 2); return r > 60 && r > 1.6 * g && r > 1.6 * b; };

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

/** A printed line of text is at most this many rows tall; a taller run of ink rows is the body, not a label. */
const TEXT_LINE_ROWS = 24;
/** The first row below the given number of text lines at the top of a panel. A line is a run of rows with ink, parted from
 * the next by an empty row; a run too tall to be text ends the search, so a body that touches its label is never cut. */
export function belowTopLines(figure: Raster, box: Box, lines: number) {
  const inkRow = (y: number) => { for (let x = box.x0 + 4; x < box.x1 - 4; x++) if (Math.max(pixel(figure, x, y, 0), pixel(figure, x, y, 1), pixel(figure, x, y, 2)) > 128) return true; return false; };
  let y = box.y0;
  for (let line = 0; line < lines; line++) {
    while (y < box.y1 && !inkRow(y)) y++;
    const start = y;
    while (y < box.y1 && inkRow(y)) y++;
    if (y - start > TEXT_LINE_ROWS) return start;
  }
  return y;
}

/** The body in one panel: its largest bright region with the red axis arrows removed and the thin gap they leave closed, holes
 * filled. Printed lines of text at the top of the panel, such as a photograph's date and phase, are left out first, since the
 * closing would otherwise join a label that nearly touches the body. */
export function panelDisc(figure: Raster, box: Box, threshold = 40, labelLines = 0): Mask {
  const width = box.x1 - box.x0, height = box.y1 - box.y0, bright = new Uint8Array(width * height);
  const firstRow = labelLines > 0 ? belowTopLines(figure, box, labelLines) - box.y0 : 0;
  for (let y = firstRow; y < height; y++) for (let x = 0; x < width; x++) {
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

/** A mask resampled so its area is that of a circle of the given radius, centred on its centroid, on a square canvas,
 * and turned in the image plane by the given angle, counter-clockwise as the image is seen. */
export function normalisedMask(mask: Mask, radius = 60, size = 200, turnDegrees = 0): Uint8Array {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) { n++; sx += i % mask.width; sy += Math.floor(i / mask.width); }
  if (!n) throw new TypeError('An empty outline cannot be compared.');
  const cx = sx / n, cy = sy / n, scale = Math.sqrt(n / Math.PI) / radius, out = new Uint8Array(size * size);
  const c = Math.cos(turnDegrees * Math.PI / 180), s = Math.sin(turnDegrees * Math.PI / 180);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5 - size / 2) * scale, v = (y + 0.5 - size / 2) * scale;
    const X = Math.round(cx + c * u - s * v - 0.5), Y = Math.round(cy + s * u + c * v - 0.5);
    out[y * size + x] = X >= 0 && Y >= 0 && X < mask.width && Y < mask.height ? mask.data[Y * mask.width + X] : 0;
  }
  return out;
}

/** Scale-free outline overlap: intersection over union of the two outlines normalised to one area and centroid, the
 * first turned in the image plane by the given angle. */
export function outlineOverlap(a: Mask, b: Mask, turnDegrees = 0) {
  const na = normalisedMask(a, 60, 200, turnDegrees), nb = normalisedMask(b); let inter = 0, union = 0;
  for (let i = 0; i < na.length; i++) { inter += na[i] & nb[i]; union += na[i] | nb[i]; }
  return inter / union;
}

/** The image-plane turn of the first outline, within ±8° in half-degree steps, that best overlaps the second. */
export function bestImageTurnDegrees(a: Mask, b: Mask) {
  let best = { turn: 0, overlap: -1 };
  for (let step = -16; step <= 16; step++) { const overlap = outlineOverlap(a, b, step / 2); if (overlap > best.overlap + 1e-12) best = { turn: step / 2, overlap }; }
  return best.turn;
}

/** The difference between two axis angles, folded to (-90, 90]. */
export const axisDifferenceDegrees = (a: number, b: number) => { const d = ((a - b) % 180 + 180) % 180; return d > 90 ? d - 180 : d; };

export const COMPARISON_BLOCK_BEGIN = '<!-- published-comparison:begin -->';
export const COMPARISON_BLOCK_END = '<!-- published-comparison:end -->';

export interface ComparisonEvidence {
  figure: string; source: string;
  columns: { label: string; overlapWithModel: number; overlapWithPhotograph: number; sameShapeOverlap: number; bestTurnDegrees: number; turns: Record<string, number>; imageTurnDegrees: { model: number; photograph: number }; axis: { paperDegrees: number | null; oursDegrees: number | null } }[];
  nativeOutline: { frames: number; residualPixelsAtZero: number; residualPixels: Record<string, number> };
}

/** The rotational phase step of the sweep that compares our outline with each of the paper's model panels. */
export const PHASE_SWEEP_STEP_DEGREES = 10;

/**
 * Where a column's phase sweep puts the best overlap with the paper's model, against our own phase: at it, one sweep
 * step from it, or elsewhere by less than the measure resolves, which a nearly round outline does. The measure's
 * resolution is what one outline loses against itself drawn at the paper's pixel size. Anything else means our
 * rotation and the paper's differ in that column.
 */
export type PhaseAgreement = 'at' | 'step' | 'unresolved' | 'elsewhere';
export function phaseAgreement(column: ComparisonEvidence['columns'][number]): PhaseAgreement {
  if (column.bestTurnDegrees === 0) return 'at';
  if (Math.abs(column.bestTurnDegrees) <= PHASE_SWEEP_STEP_DEGREES) return 'step';
  const ours = column.turns['0'];
  if (ours === undefined) throw new TypeError(`Column ${column.label} has no sweep score at our phase.`);
  return Math.max(...Object.values(column.turns)) - ours < 1 - column.sameShapeOverlap ? 'unresolved' : 'elsewhere';
}

/** The evidence a README block is written from, validated. */
export function parseComparisonEvidence(value: unknown): ComparisonEvidence {
  const record = requireRecord(value, 'comparison evidence');
  if (record.schema !== COMPARISON_EVIDENCE_SCHEMA) throw new TypeError(`Comparison evidence states schema ${COMPARISON_EVIDENCE_SCHEMA}.`);
  const angle = (value: unknown, at: string) => value === null ? null : requireFiniteNumber(value, at);
  const native = requireRecord(record.nativeOutline, 'native outline'), sweep = requireRecord(native.residualPixels, 'residual sweep');
  return { figure: requireString(record.figure, 'figure'), source: requireString(record.source, 'source'),
    columns: requireArray(record.columns, 'columns').map((value, index) => {
      const column = requireRecord(value, `column ${index}`), axis = requireRecord(column.axis, `column ${index} axis`), image = requireRecord(column.imageTurnDegrees, `column ${index} image turn`);
      return { label: requireString(column.label, 'label'), overlapWithModel: requireFiniteNumber(column.overlapWithModel, 'model overlap'),
        overlapWithPhotograph: requireFiniteNumber(column.overlapWithPhotograph, 'photograph overlap'), sameShapeOverlap: requireFiniteNumber(column.sameShapeOverlap, 'same-shape overlap'),
        bestTurnDegrees: requireFiniteNumber(column.bestTurnDegrees, 'best turn'),
        turns: Object.fromEntries(Object.entries(requireRecord(column.turns, `column ${index} phase sweep`)).map(([turn, overlap]) => [turn, requireFiniteNumber(overlap, `column ${index} overlap at ${turn}°`)])),
        imageTurnDegrees: { model: requireFiniteNumber(image.model, 'image turn onto the model'), photograph: requireFiniteNumber(image.photograph, 'image turn onto the photograph') },
        axis: { paperDegrees: angle(axis.paperDegrees, 'paper axis'), oursDegrees: angle(axis.oursDegrees, 'our axis') } };
    }),
    nativeOutline: { frames: requireFiniteNumber(native.frames, 'frames'), residualPixelsAtZero: requireFiniteNumber(native.residualPixelsAtZero, 'residual'),
      residualPixels: Object.fromEntries(Object.entries(sweep).map(([offset, pixels]) => [offset, requireFiniteNumber(pixels, `residual at ${offset}`)])) } };
}

/** The README's comparison section, written from the evidence so that none of its numbers is typed. */
export function comparisonBlock(evidence: ComparisonEvidence): string {
  const number = (value: number) => value.toFixed(3), degrees = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}°`;
  const sweep = Object.entries(evidence.nativeOutline.residualPixels).map(([offset, pixels]) => ({ offset: Number(offset), pixels })).sort((a, b) => a.pixels - b.pixels || Math.abs(a.offset) - Math.abs(b.offset));
  const lowest = sweep[0], native = evidence.nativeOutline;
  return [
    `Measured by \`tools/objects/published-comparison.mts\` against [${evidence.figure}](${evidence.source}), the survey's comparison of these frames with its models. The numbers are read from [\`evidence/published-comparison.json\`](evidence/published-comparison.json), not typed; [the paper's photographs with its model's outline and ours](evidence/published-comparison.webp) show them.`,
    '',
    '| Figure column | Overlap with the paper\'s model | With the paper\'s photograph | Same shape at both pixel sizes | Best turn | Image turn onto the model, the photograph | Spin axis, ours against the figure\'s |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...evidence.columns.map(column => `| ${column.label.replace('T', ' ')} | ${number(column.overlapWithModel)} | ${number(column.overlapWithPhotograph)} | ${number(column.sameShapeOverlap)} | ${column.bestTurnDegrees}° | ${column.imageTurnDegrees.model}°, ${column.imageTurnDegrees.photograph}° | ${degrees(column.axis.oursDegrees)} against ${degrees(column.axis.paperDegrees)} |`),
    '',
    `Overlaps are scale-free. Read each against the same-shape column, which is what the measure gives one outline drawn at both pixel sizes. The best turn is the rotational phase, in 10° steps, at which our outline best overlaps the paper's model. The image turn is how far our outline must turn in the picture, counter-clockwise and in half degrees, to best overlap the paper's model and its photograph. The outline residual in the ${native.frames} native frames after the centre fit is ${native.residualPixelsAtZero.toFixed(3)} px at our phase${lowest.offset === 0 ? ', the lowest of a ±30° sweep' : `; the lowest of a ±30° sweep is ${lowest.pixels.toFixed(3)} px at ${lowest.offset}°`}.`,
  ].join('\n');
}

export function withComparisonBlock(readme: string, block: string) {
  const begin = readme.indexOf(COMPARISON_BLOCK_BEGIN), end = readme.indexOf(COMPARISON_BLOCK_END);
  if (begin < 0 || end < 0 || end < begin) return { readme, replaced: false };
  return { readme: `${readme.slice(0, begin + COMPARISON_BLOCK_BEGIN.length)}\n${block}\n${readme.slice(end)}`, replaced: true };
}
