import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { CHART, chartAxes, chartDocument, chartNotes, coordinate, escapeXml } from './chart-style.mts';

interface ProfileSource {
  path: string; label: string; color: string; pressureUnit: 'Pa' | 'bar'; expectedRows: number;
  columns: { pressure: number; median: number; lower: number; upper: number };
}
interface Axis { minimum: number; maximum: number; ticks: { value: number; label: string }[] }
export interface RetrievedProfileRecipe {
  kind: 'retrieved-profile'; id: string; title: string; description: string; output: string;
  metadata: Record<string, unknown>; series: ProfileSource[]; pressure: Axis; temperature: Axis;
  probedPressure: { minimum: number; maximum: number }; notes: string[];
}
export interface ProfilePoint { pressure: number; median: number; lower: number; upper: number }

function localPath(value: unknown) {
  const path = requireString(value, 'profile path');
  if (!path.trim() || path.startsWith('/') || path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) throw new TypeError('Profile path must stay inside the source directory.');
  return path;
}
function integer(value: unknown, minimum: number) {
  const n = requireFiniteNumber(value, 'profile integer');
  if (!Number.isSafeInteger(n) || n < minimum) throw new TypeError('Invalid profile row count or column.');
  return n;
}
function range(value: unknown) {
  const r = requireRecord(value, 'profile range');
  const minimum = requireFiniteNumber(r.minimum), maximum = requireFiniteNumber(r.maximum);
  if (!(maximum > minimum && minimum > 0)) throw new TypeError('Profile ranges must be positive and increasing.');
  return { minimum, maximum };
}
function axis(value: unknown): Axis {
  const r = requireRecord(value, 'profile axis'), bounds = range(r);
  const ticks = requireArray(r.ticks).map(value => {
    const tick = requireRecord(value);
    return { value: requireFiniteNumber(tick.value), label: requireString(tick.label) };
  });
  if (ticks.length < 2 || ticks.some((t, i) => t.value < bounds.minimum || t.value > bounds.maximum || i > 0 && t.value <= ticks[i - 1]!.value)) throw new TypeError('Invalid profile axis ticks.');
  return { ...bounds, ticks };
}
export function parseRetrievedProfile(value: unknown): RetrievedProfileRecipe {
  const r = requireRecord(value, 'retrieved profile'), id = requireString(r.id);
  if (r.kind !== 'retrieved-profile' || !/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid retrieved-profile identity.');
  const series = requireArray(r.series).map((value): ProfileSource => {
    const s = requireRecord(value), c = requireRecord(s.columns), color = requireString(s.color);
    if (s.pressureUnit !== 'Pa' && s.pressureUnit !== 'bar') throw new TypeError('Profile pressure unit must be Pa or bar.');
    if (!/^#[a-f0-9]{6}$/i.test(color)) throw new TypeError('Invalid profile color.');
    const columns = { pressure: integer(c.pressure, 0), median: integer(c.median, 0), lower: integer(c.lower, 0), upper: integer(c.upper, 0) };
    if (new Set(Object.values(columns)).size !== 4) throw new TypeError('Profile columns must be distinct.');
    return { path: localPath(s.path), label: requireString(s.label), color, pressureUnit: s.pressureUnit, expectedRows: integer(s.expectedRows, 2), columns };
  });
  const notes = requireArray(r.notes).map(value => requireString(value));
  if (series.length < 1 || series.length > 3 || series.some(s => s.label.length > 38) || notes.length > 4 || notes.some(note => note.length > 49)) throw new TypeError('Profile text exceeds the prepared layout.');
  const pressure = axis(r.pressure), probedPressure = range(r.probedPressure);
  if (probedPressure.minimum < pressure.minimum || probedPressure.maximum > pressure.maximum) throw new TypeError('Probed pressures lie outside the plot.');
  return { kind: 'retrieved-profile', id, title: requireString(r.title), description: requireString(r.description), output: localPath(r.output),
    metadata: requireRecord(r.metadata), series, pressure, temperature: axis(r.temperature), probedPressure, notes };
}

/** Quantile columns are absolute temperatures, not +/- errors. Preserve every native sample and its pressure unit. */
export function readProfileTable(text: string, source: ProfileSource): ProfilePoint[] {
  const c = source.columns;
  const rows = text.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('#')).map(line => {
    const row = line.trim().split(/\s+/).map(Number);
    if (row.some(v => !Number.isFinite(v))) throw new TypeError('Non-finite profile sample.');
    const point = { pressure: requireFiniteNumber(row[c.pressure]) / (source.pressureUnit === 'Pa' ? 100000 : 1),
      median: requireFiniteNumber(row[c.median]), lower: requireFiniteNumber(row[c.lower]), upper: requireFiniteNumber(row[c.upper]) };
    if (!(point.pressure > 0 && point.lower > 0 && point.lower <= point.median && point.median <= point.upper)) throw new TypeError('Invalid profile pressure or quantile order.');
    return point;
  });
  if (rows.length !== source.expectedRows) throw new TypeError('Profile row count differs.');
  const direction = Math.sign(rows[1]!.pressure - rows[0]!.pressure);
  if (!direction || rows.some((row, i) => i > 0 && Math.sign(row.pressure - rows[i - 1]!.pressure) !== direction)) throw new TypeError('Profile pressures must be strictly monotonic.');
  return direction > 0 ? rows : rows.reverse();
}

/** Crop in log-pressure space, interpolating only the two plot-boundary crossings. Never extrapolate or refit. */
export function profileWindow(rows: readonly ProfilePoint[], minimum: number, maximum: number): ProfilePoint[] {
  if (rows[0]!.pressure > minimum || rows.at(-1)!.pressure < maximum) throw new RangeError('Profile does not cover the displayed pressure range.');
  const at = (pressure: number): ProfilePoint => {
    const i = rows.findIndex(row => row.pressure >= pressure), b = rows[i]!;
    if (b.pressure === pressure) return b;
    const a = rows[i - 1]!, t = Math.log(pressure / a.pressure) / Math.log(b.pressure / a.pressure);
    const interpolate = (key: 'median' | 'lower' | 'upper') => a[key] + (b[key] - a[key]) * t;
    return { pressure, median: interpolate('median'), lower: interpolate('lower'), upper: interpolate('upper') };
  };
  return [at(minimum), ...rows.filter(row => row.pressure > minimum && row.pressure < maximum), at(maximum)];
}
export async function readRetrievedProfile(root: string, input: unknown) {
  const recipe = parseRetrievedProfile(input);
  const series = await Promise.all(recipe.series.map(async source => {
    const rows = readProfileTable(await readFile(resolve(root, source.path), 'utf8'), source);
    const points = profileWindow(rows, recipe.pressure.minimum, recipe.pressure.maximum);
    if (points.some(p => p.lower < recipe.temperature.minimum || p.upper > recipe.temperature.maximum)) throw new RangeError('Temperature axis would clip a profile uncertainty.');
    return { source, points };
  }));
  return { recipe, series };
}

export function renderRetrievedProfile({ recipe: r, series }: Awaited<ReturnType<typeof readRetrievedProfile>>) {
  const x = (t: number) => 42 + (t - r.temperature.minimum) / (r.temperature.maximum - r.temperature.minimum) * 252;
  const y = (p: number) => 29 + Math.log(p / r.pressure.minimum) / Math.log(r.pressure.maximum / r.pressure.minimum) * 174;
  const n = coordinate, height = 260 + series.length * 17 + r.notes.length * 15;
  const color = (source: ProfileSource) => series.length === 1 ? CHART.neutral : source.color;
  const path = (points: readonly ProfilePoint[], key: 'median' | 'lower' | 'upper', start = 'M') => points.map((p, i) => `${i ? 'L' : start}${n(x(p[key]))} ${n(y(p.pressure))}`).join(' ');
  const bands = series.map(({ source: s, points }) => `<path class="profile-interval" d="${path(points, 'lower')} ${path([...points].reverse(), 'upper', 'L')} Z" fill="${color(s)}" fill-opacity="${CHART.bandOpacity}"/>`).join('');
  const curves = series.map(({ source: s, points }, i) => `<path class="profile-median" d="${path(points, 'median')}" fill="none" stroke="${color(s)}" stroke-width="1.5"${i === 1 ? ' stroke-dasharray="4 2"' : ''}/>`).join('');
  const legend = series.map(({ source: s }, i) => `<path d="M0 ${244 + i * 17}H19" stroke="${color(s)}" stroke-width="1.5"${i === 1 ? ' stroke-dasharray="4 2"' : ''}/><text x="26" y="${248 + i * 17}">${escapeXml(s.label)}</text>`).join('');
  const axes = chartAxes({ x, y, xTicks: r.temperature.ticks, yTicks: r.pressure.ticks,
    xLabel: 'Temperature (K)', yLabel: 'Pressure (bar)', direction: 'Higher atmosphere ↑' });
  const probed = [r.probedPressure.minimum, r.probedPressure.maximum].map(p => `<path class="probed-pressure" d="M42 ${n(y(p))}H294" stroke="${CHART.label}" stroke-opacity=".6" stroke-dasharray="2 3"/>`).join('');
  return chartDocument({ ...r, metadata: { ...r.metadata, pressureUnit: 'bar', temperatureUnit: 'K',
    pressureRange: [r.pressure.minimum, r.pressure.maximum], nativeRows: r.series.map(s => s.expectedRows) } },
    axes + bands + probed + curves + legend + chartNotes(r.notes, 264 + series.length * 17), { height });
}
