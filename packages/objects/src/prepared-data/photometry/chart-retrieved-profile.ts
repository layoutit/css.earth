import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
export interface ProfileSource {
  path: string; label: string; color: string; pressureUnit: 'Pa' | 'bar'; expectedRows: number;
  columns: { pressure: number; median: number; lower: number; upper: number };
}
interface Axis { minimum: number; maximum: number; ticks: { value: number; label: string }[] }
export interface RetrievedProfileRecipe {
  kind: 'retrieved-profile'; id: string; title: string; description: string; output: string;
  metadata: Record<string, unknown>; series: ProfileSource[]; pressure: Axis; temperature: Axis;
  probedPressure: { minimum: number; maximum: number }; notes: string[];
}
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

