// Measured charts are prepared from pinned tables. Runtime receives an image and
// an accessible CSV; it never parses observations or derives plotting geometry.
import { createHash } from 'node:crypto';
import { readJwstSpectrum } from './jwst-spectrum.js';
import type { JwstSpectrumIdentity } from './jwst-spectrum.js';

export interface ObservationAxis {
  label: string;
  minimum: number;
  maximum: number;
  ticks: number[];
  reverse?: boolean;
}

export interface ObservationRecipe {
  kind: 'observations';
  id: string;
  title: string;
  description: string;
  output: string;
  dataOutput: string;
  metadata: Record<string, unknown>;
  source: string;
  sha256: string;
  format: 'csv' | 'whitespace' | 'sectioned-csv' | 'jwst-x1d';
  fits?: JwstSpectrumIdentity;
  header?: string;
  section?: string;
  sampleCount: number;
  columns: { x: number; y: number; error?: number; count: number };
  yScale?: number;
  uncertainty: 'one-sigma' | 'not-released';
  exclude?: { minimum: number; maximum: number; reason: string }[];
  x: ObservationAxis;
  y: ObservationAxis;
}

export interface ObservationPoint { x: number; y: number; error?: number; quality?: number; excluded: boolean; }

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateObservationRecipe(chart: ObservationRecipe) {
  if (!/^[a-f0-9]{64}$/.test(chart.sha256) || !Number.isSafeInteger(chart.sampleCount) ||
      chart.sampleCount < 2 || chart.sampleCount > 10000 ||
      !['csv', 'whitespace', 'sectioned-csv', 'jwst-x1d'].includes(chart.format) ||
      !['one-sigma', 'not-released'].includes(chart.uncertainty)) {
    throw new TypeError('Invalid observation source identity or sampling.');
  }
  if (chart.format === 'jwst-x1d' && (!chart.fits ||
      ['targetName', 'calibrationVersion', 'crdsContext', 'observationDate'].some(key =>
        typeof chart.fits![key as keyof JwstSpectrumIdentity] !== 'string' ||
        !chart.fits![key as keyof JwstSpectrumIdentity].trim()) || chart.uncertainty !== 'one-sigma')) {
    throw new TypeError('JWST spectra require a pinned calibration and target identity.');
  }
  const cols = chart.columns;
  if (!cols || !Number.isSafeInteger(cols.count) || cols.count < 2 || cols.count > 10 ||
      [cols.x, cols.y, ...(cols.error === undefined ? [] : [cols.error])].some(
        index => !Number.isSafeInteger(index) || index < 0 || index >= cols.count) ||
      new Set([cols.x, cols.y, cols.error].filter(index => index !== undefined)).size !==
        (cols.error === undefined ? 2 : 3) ||
      (chart.uncertainty === 'one-sigma') !== (cols.error !== undefined) ||
      (chart.format === 'csv' && !chart.header) ||
      (chart.format === 'sectioned-csv' && !chart.section) ||
      (chart.yScale !== undefined && (!finite(chart.yScale) || chart.yScale <= 0))) {
    throw new TypeError('Observation columns, units or uncertainty are ambiguous.');
  }
  for (const axis of [chart.x, chart.y]) {
    if (!axis || !axis.label?.trim() || !finite(axis.minimum) || !finite(axis.maximum) ||
        axis.minimum >= axis.maximum || !Array.isArray(axis.ticks) ||
        axis.ticks.length < 2 || axis.ticks.length > 8 ||
        (axis.reverse !== undefined && typeof axis.reverse !== 'boolean') ||
        axis.ticks.some((tick, i) => !finite(tick) || tick < axis.minimum || tick > axis.maximum ||
          i > 0 && tick <= axis.ticks[i - 1])) {
      throw new TypeError('Invalid observation axis.');
    }
  }
  if (chart.exclude !== undefined && (!Array.isArray(chart.exclude) || chart.exclude.some(
    range => !finite(range.minimum) || !finite(range.maximum) ||
      range.minimum >= range.maximum || !range.reason?.trim()))) {
    throw new TypeError('Excluded observation ranges require an explicit reason.');
  }
}

export function parseObservations(bytes: Uint8Array, chart: ObservationRecipe): ObservationPoint[] {
  validateObservationRecipe(chart);
  if (createHash('sha256').update(bytes).digest('hex') !== chart.sha256) {
    throw new Error('Observation source hash differs from the reviewed release.');
  }
  if (chart.format === 'jwst-x1d') {
    const points = readJwstSpectrum(bytes, chart.fits!).map(point => ({ ...point,
      y: point.y * (chart.yScale ?? 1), error: point.error * (chart.yScale ?? 1),
      excluded: point.excluded || Boolean(chart.exclude?.some(range => point.x >= range.minimum && point.x <= range.maximum)),
    }));
    if (points.length !== chart.sampleCount || points.some((point, index) =>
      index > 0 && point.x <= points[index - 1].x || !point.excluded &&
      (!finite(point.y) || !finite(point.error)))) throw new TypeError('JWST sampling or scaling drifted.');
    return points;
  }
  const lines = Buffer.from(bytes).toString('utf8').trim().split(/\r?\n/);
  let rows: string[];
  if (chart.format === 'csv') {
    if (lines.shift() !== chart.header) throw new TypeError('Observation header or units differ.');
    rows = lines;
  } else if (chart.format === 'sectioned-csv') {
    const starts = lines.flatMap((line, index) => line.trim() === chart.section ? [index] : []);
    if (starts.length !== 1) throw new TypeError('Observation sequence must occur exactly once.');
    rows = [];
    for (const line of lines.slice(starts[0] + 1)) {
      if (/^ISS_/.test(line)) break;
      if (line.trim()) rows.push(line);
    }
  } else rows = lines;
  const points = rows.map(line => {
    const fields = line.trim().split(chart.format === 'whitespace' ? /\s+/ : /,/);
    if (fields.length !== chart.columns.count || fields.some(field => !field.trim())) {
      throw new TypeError('Observation row has missing or unexpected columns.');
    }
    const values = fields.map(Number);
    if (values.some(value => !finite(value))) throw new TypeError('Observation sample is not finite.');
    const x = values[chart.columns.x];
    const y = values[chart.columns.y] * (chart.yScale ?? 1);
    const error = chart.columns.error === undefined ? undefined : values[chart.columns.error] * (chart.yScale ?? 1);
    if (!finite(y) || error !== undefined && (!finite(error) || error < 0)) {
      throw new TypeError('Observation scaling or uncertainty is invalid.');
    }
    return { x, y, ...(error === undefined ? {} : { error }), excluded: Boolean(
      chart.exclude?.some(range => x >= range.minimum && x <= range.maximum)) };
  });
  if (points.length !== chart.sampleCount) throw new TypeError('Observation sample count drifted.');
  // Rotational phase wraps between exposures; spectra must remain monotonic.
  if (chart.format !== 'sectioned-csv' && points.some((point, i) => i > 0 && point.x <= points[i - 1].x)) {
    throw new TypeError('Observed wavelengths must increase strictly.');
  }
  return points;
}

const xml = (value: unknown) => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const csv = (value: unknown) => `"${String(value).replace(/"/g, '""')}"`;

export function observationCsv(points: ObservationPoint[], chart: ObservationRecipe) {
  const hasQuality = points.some(point => point.quality !== undefined);
  const header = [chart.x.label, chart.y.label,
    ...(chart.uncertainty === 'one-sigma' ? ['1-sigma uncertainty (same y units)'] : []),
    'Excluded from plot', 'Source row (zero based)', ...(hasQuality ? ['Data quality flags'] : [])];
  return header.map(csv).join(',') + '\n' + points.map((p, index) =>
    [p.x, finite(p.y) ? p.y : '', ...(p.error === undefined ? [] : [finite(p.error) ? p.error : '']),
      p.excluded || p.x < chart.x.minimum || p.x > chart.x.maximum,
      index, ...(hasQuality ? [p.quality] : [])].map(csv).join(',')).join('\n') + '\n';
}

export function renderObservationChart(points: ObservationPoint[], chart: ObservationRecipe) {
  validateObservationRecipe(chart);
  const left = 56, right = 350, top = 42, bottom = 180;
  const project = (value: number, axis: ObservationAxis, start: number, end: number) => {
    const t = (value - axis.minimum) / (axis.maximum - axis.minimum);
    return start + (axis.reverse ? 1 - t : t) * (end - start);
  };
  const px = (x: number) => project(x, chart.x, left, right);
  const py = (y: number) => project(y, chart.y, bottom, top);
  const n = (value: number) => value.toFixed(3);
  const shown = points.filter(p => !p.excluded && p.x >= chart.x.minimum && p.x <= chart.x.maximum);
  if (!shown.length) throw new RangeError('Observation chart contains no samples.');
  // Axis limits are source-owned and must include the plotted measurements and
  // their released errors. Never silently clip noise into a cleaner spectrum.
  if (shown.some(p => p.y - (p.error ?? 0) < chart.y.minimum || p.y + (p.error ?? 0) > chart.y.maximum)) {
    throw new RangeError('Observation axis would hide samples or uncertainty.');
  }
  const grid = chart.y.ticks.map(value => `<path d="M${left} ${n(py(value))}H${right}" stroke="#d0d4dc" stroke-opacity=".14"/><text x="48" y="${n(py(value) + 4)}" text-anchor="end">${xml(value)}</text>`).join('');
  const ticks = chart.x.ticks.map(value => `<text x="${n(px(value))}" y="199" text-anchor="middle">${xml(value)}</text>`).join('');
  const errors = shown.filter(p => p.error !== undefined).map(p =>
    `<path d="M${n(px(p.x))} ${n(py(p.y - p.error!))}V${n(py(p.y + p.error!))}"/>`).join('');
  const dots = shown.map(p => `<circle cx="${n(px(p.x))}" cy="${n(py(p.y))}" r="1.15"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="232" viewBox="0 0 360 232" role="img" aria-labelledby="title description" font-family="Arial, sans-serif" font-size="11" fill="#bbc3d2">
<title id="title">${xml(chart.title)}</title><desc id="description">${xml(chart.description)}</desc>
<metadata>${xml(JSON.stringify({ ...chart.metadata, sourceSha256: chart.sha256, sampleCount: points.length, plottedSampleCount: shown.length, uncertainty: chart.uncertainty }))}</metadata>
<text x="${left}" y="16" fill="#edf2fc" font-size="12">${xml(chart.title)}</text>
<text x="${left}" y="32">${xml(chart.y.label)}</text>
${grid}${ticks}<path d="M${left} ${top}V${bottom}H${right}" fill="none" stroke="#bbc3d2" stroke-opacity=".45"/>
<g fill="none" stroke="#80b9e8" stroke-width=".8" stroke-opacity=".48">${errors}</g>
<g fill="#b3d8f5">${dots}</g>
<text x="203" y="221" text-anchor="middle">${xml(chart.x.label)}</text>
</svg>\n`;
}
