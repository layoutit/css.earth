import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
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

