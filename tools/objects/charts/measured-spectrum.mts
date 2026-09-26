import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export interface Measurement { x: number; xLow: number; xHigh: number; y: number; minus: number; plus: number }
export interface MeasurementSource {
  path: string;
  format: 'records' | 'columns';
  columns?: { x: number; xError: number; y: number; error: number };
  yScale: number;
  expectedRows: number;
}
export interface MeasuredSpectrumRecipe {
  kind: 'measured-spectrum'; id: string; title: string; description: string; output: string;
  metadata: Record<string, unknown>;
  source: MeasurementSource;
  mode: 'points' | 'band';
  x: { label: string; minimum: number; maximum: number; ticks: number[] };
  y: { label: string; minimum: number; maximum: number; ticks: number[] };
  notes: string[];
  model?: { path: string; label: string; yScale: number; expectedRows: number };
}

function localPath(value: unknown): string {
  const path = requireString(value, 'spectrum path');
  if (!path.trim() || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) throw new TypeError('Spectrum path must stay inside the source directory.');
  return path;
}
function positive(value: unknown, label: string) {
  const n = requireFiniteNumber(value, label);
  if (!(n > 0)) throw new TypeError(`${label} must be positive.`);
  return n;
}
function integer(value: unknown, label: string, minimum = 0) {
  const n = requireFiniteNumber(value, label);
  if (!Number.isSafeInteger(n) || n < minimum) throw new TypeError(`${label} must be an integer >= ${minimum}.`);
  return n;
}
function axis(value: unknown) {
  const r = requireRecord(value, 'axis');
  const minimum = requireFiniteNumber(r.minimum, 'axis minimum'), maximum = requireFiniteNumber(r.maximum, 'axis maximum');
  const ticks = requireArray(r.ticks, 'axis ticks').map(v => requireFiniteNumber(v, 'tick'));
  if (!(maximum > minimum) || ticks.length < 2 || ticks.some((v, i) => v < minimum || v > maximum || i > 0 && v <= ticks[i - 1]!)) throw new TypeError('Invalid measured-spectrum axis.');
  return { label: requireString(r.label, 'axis label'), minimum, maximum, ticks };
}

export function parseMeasuredSpectrum(value: unknown): MeasuredSpectrumRecipe {
  const r = requireRecord(value, 'measured spectrum'), s = requireRecord(r.source, 'measurement source');
  if (r.kind !== 'measured-spectrum' || !['points', 'band'].includes(String(r.mode))) throw new TypeError('Invalid measured-spectrum kind or mode.');
  if (s.format !== 'records' && s.format !== 'columns') throw new TypeError('Unknown measurement source format.');
  const id = requireString(r.id, 'chart id');
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid chart id.');
  const source: MeasurementSource = { path: localPath(s.path), format: s.format, yScale: positive(s.yScale ?? 1, 'measurement scale'), expectedRows: integer(s.expectedRows, 'measurement count', 1) };
  if (s.format === 'columns') {
    const c = requireRecord(s.columns, 'measurement columns');
    source.columns = { x: integer(c.x, 'x column'), xError: integer(c.xError, 'x error column'), y: integer(c.y, 'y column'), error: integer(c.error, 'error column') };
  }
  const notes = requireArray(r.notes, 'chart notes').map(v => requireString(v, 'chart note'));
  if (notes.length > 5 || notes.some(note => note.length > 52)) throw new TypeError('Chart notes exceed the prepared layout.');
  const chart: MeasuredSpectrumRecipe = { kind: 'measured-spectrum', id, title: requireString(r.title, 'title'), description: requireString(r.description, 'description'), output: localPath(r.output),
    metadata: requireRecord(r.metadata, 'chart metadata'), source, mode: r.mode === 'band' ? 'band' : 'points', x: axis(r.x), y: axis(r.y), notes };
  if (r.model !== undefined) {
    const m = requireRecord(r.model, 'model');
    chart.model = { path: localPath(m.path), label: requireString(m.label, 'model label'), yScale: positive(m.yScale ?? 1, 'model scale'), expectedRows: integer(m.expectedRows, 'model count', 2) };
  }
  return chart;
}

function numericRows(text: string): number[][] {
  return text.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#')).map(line => line.trim().split(/\s+/).map(token => {
    if (/^nan$/i.test(token)) return NaN;
    const value = Number(token);
    if (!Number.isFinite(value)) throw new TypeError(`Invalid spectrum number: ${token}`);
    return value;
  }));
}

/** Keeps all measured bins, including overlapping visits and signed noisy estimates. No fitting or resampling. */
export async function readMeasuredSpectrum(root: string, input: unknown) {
  const recipe = parseMeasuredSpectrum(input), source = recipe.source;
  const text = await readFile(resolve(root, source.path), 'utf8');
  let points: Measurement[];
  if (source.format === 'records') {
    const document = requireRecord(JSON.parse(text), 'measurement document');
    if (document.schema !== 'cssearth-measured-spectrum@1') throw new TypeError('Unknown measurement document schema.');
    points = requireArray(document.measurements, 'measurements').map(value => {
      const p = requireRecord(value, 'measurement'), number = (key: string) => requireFiniteNumber(p[key], key);
      const xLow = number('xLow'), xHigh = number('xHigh');
      // An integrated band has no representative wavelength: this midpoint only positions its error bar.
      const x = p.x === undefined && recipe.mode === 'band' ? (xLow + xHigh) / 2 : number('x');
      return { x, xLow, xHigh, y: number('y') * source.yScale, minus: number('minus') * source.yScale, plus: number('plus') * source.yScale };
    });
  } else {
    const c = source.columns;
    if (!c) throw new TypeError('Missing spectrum columns.');
    points = numericRows(text).map(row => {
      const x = requireFiniteNumber(row[c.x], 'wavelength'), dx = requireFiniteNumber(row[c.xError], 'bin half-width');
      if (dx < 0) throw new TypeError('Negative wavelength half-width.');
      const y = requireFiniteNumber(row[c.y], 'measurement') * source.yScale, error = requireFiniteNumber(row[c.error], 'measurement error') * source.yScale;
      return { x, xLow: x - dx, xHigh: x + dx, y, minus: error, plus: error };
    });
  }
  if (points.length !== source.expectedRows || points.some(p => p.xLow > p.x || p.xHigh < p.x || p.minus < 0 || p.plus < 0)) throw new TypeError('Measurement count, bounds or errors differ.');
  const inside = (p: Measurement) => p.xLow >= recipe.x.minimum && p.xHigh <= recipe.x.maximum && p.y - p.minus >= recipe.y.minimum && p.y + p.plus <= recipe.y.maximum;
  if (!points.every(inside)) throw new RangeError('Chart axes would clip a measurement or its uncertainty.');
  const model: { x: number; y: number | null }[] = [];
  if (recipe.model) {
    const rows = numericRows(await readFile(resolve(root, recipe.model.path), 'utf8'));
    if (rows.length !== recipe.model.expectedRows) throw new TypeError('Model row count differs.');
    rows.forEach((row, i) => {
      const x = requireFiniteNumber(row[0], 'model wavelength');
      if (row.length !== 2 || i > 0 && x <= rows[i - 1]![0]!) throw new TypeError('Model wavelengths must increase.');
      if (x < recipe.x.minimum || x > recipe.x.maximum) return;
      const y = Number.isNaN(row[1]) ? null : requireFiniteNumber(row[1], 'model value') * recipe.model!.yScale;
      if (y !== null && (y < recipe.y.minimum || y > recipe.y.maximum)) throw new RangeError('Chart axes would clip the model.');
      model.push({ x, y });
    });
    if (model.filter(p => p.y !== null).length < 2) throw new TypeError('No model samples within the chart.');
  }
  return { recipe, points, model };
}

const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Prepared SVG in the existing chart panel. Horizontal bars are wavelength coverage, vertical bars are published errors. */
export function renderMeasuredSpectrum({ recipe: r, points, model }: Awaited<ReturnType<typeof readMeasuredSpectrum>>) {
  const width = 306, height = 220 + r.notes.length * 15;
  const x = (v: number) => 40 + (v - r.x.minimum) / (r.x.maximum - r.x.minimum) * 255;
  const y = (v: number) => 166 - (v - r.y.minimum) / (r.y.maximum - r.y.minimum) * 132;
  const n = (v: number) => v.toFixed(3);
  const line = (x1: number, y1: number, x2: number) => `M${n(x1)} ${n(y1)}H${n(x2)}`;
  const grid = r.y.ticks.map(v => `<path d="M40 ${n(y(v))}H295" stroke-opacity="${v === 0 ? '.3' : '.1'}"/><text x="34" y="${n(y(v) + 4)}" text-anchor="end" stroke="none">${v}</text>`).join('');
  const ticks = r.x.ticks.map(v => `<text x="${n(x(v))}" y="184" text-anchor="${v === r.x.minimum ? 'start' : v === r.x.maximum ? 'end' : 'middle'}">${v}</text>`).join('');
  let pen = false;
  const path = model.map(p => { if (p.y === null) { pen = false; return ''; } const d = `${pen ? 'L' : 'M'}${n(x(p.x))} ${n(y(p.y))}`; pen = true; return d; }).join(' ');
  const bars = points.map(p => `<g class="measurement" data-x="${p.x}" data-y="${p.y}" data-minus="${p.minus}" data-plus="${p.plus}">
    <path d="${line(x(p.xLow), y(p.y), x(p.xHigh))} M${n(x(p.x))} ${n(y(p.y + p.plus))}V${n(y(p.y - p.minus))}"/>
    ${r.mode === 'points' ? `<circle cx="${n(x(p.x))}" cy="${n(y(p.y))}" r="1.7" fill="#d5d8e0" stroke="none"/>` : ''}</g>`).join('');
  const notes = r.notes.map((note, i) => `<text x="0" y="${221 + i * 15}" fill-opacity=".8">${escape(note)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${r.id}-title ${r.id}-desc" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="#b8bbc4">
    <title id="${r.id}-title">${escape(r.title)}</title><desc id="${r.id}-desc">${escape(r.description)}</desc>
    <metadata>${escape(JSON.stringify({ ...r.metadata, measuredBins: points.length, modelSamplesShown: model.length }))}</metadata>
    <text x="0" y="13">${escape(r.y.label)}</text>
    <g stroke="#b8bbc4" stroke-width=".6">${grid}</g>
    ${r.model ? `<text x="295" y="28" text-anchor="end" fill="#e6ab64">${escape(r.model.label)}</text><path class="published-model" d="${path}" fill="none" stroke="#e6ab64" stroke-width="1.2"/>` : ''}
    <g stroke="#b8bbc4" stroke-width=".7" fill="none">${bars}</g>
    ${ticks}<text x="167.5" y="203" text-anchor="middle">${escape(r.x.label)}</text>${notes}
  </svg>\n`;
}
