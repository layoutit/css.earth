/** A surface map deposited as a table of equal-area cells in latitude belts, as the inversLSD Zeeman-Doppler imaging code writes
 * its maps (Kochukhov et al. 2014; the VizieR tables of Willamo et al. 2022, J/A+A/659/A71):
 *
 * - `latitude-belt-map`: `path` names the whitespace table and `column` the 1-based column drawn. The first two columns are latitude
 *   and longitude in degrees. Rows run belt by belt from south to north; each belt shares one latitude, and its n cells sit at
 *   longitudes (k + 1/2) * 360 / n.
 *
 * The layout is checked, not assumed. A sample is linear in longitude around its belt, then linear in latitude between the two
 * belts either side, so every cell centre keeps its deposited value. Poleward of the last belt the belt's own value is held.
 * `valueTransform.scale` converts the table's unit to the drawn one (kG to G). `outlineLatitudes` (optional) are drawn as thin
 * black lines, for a limit the paper draws, such as the latitude the star never turns toward us. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

export function parseLatitudeBelts(text: string, path: string, column: number) {
  const rows = text.split('\n').filter(line => line.trim() && !line.trimStart().startsWith('#')).map((line, i) => {
    const row = line.trim().split(/\s+/u).map(Number);
    if (row.length < Math.max(3, column) || row.some(v => !Number.isFinite(v))) throw new TypeError(`${path}: row ${i + 1} does not hold ${Math.max(3, column)} numbers.`);
    return row;
  });
  const belts: { latitude: number; values: number[] }[] = [];
  for (const row of rows) {
    const last = belts.at(-1);
    if (last && row[0] === last.latitude) last.values.push(row[column - 1]!);
    else {
      if (last && row[0]! <= last.latitude) throw new TypeError(`${path}: belt at latitude ${row[0]} follows ${last.latitude}; belts must run south to north.`);
      belts.push({ latitude: row[0]!, values: [row[column - 1]!] });
    }
  }
  if (belts.length < 2) throw new TypeError(`${path}: ${belts.length} latitude belt; a map needs at least two.`);
  let i = 0;
  for (const belt of belts) for (let k = 0; k < belt.values.length; k++, i++) {
    const expected = (k + 0.5) * 360 / belt.values.length;
    if (Math.abs(rows[i]![1]! - expected) > 2e-3) throw new TypeError(`${path}: cell ${k} of the belt at ${belt.latitude} is at longitude ${rows[i]![1]}, not ${expected.toFixed(3)}.`);
  }
  return belts;
}

export async function loadLatitudeBeltMap(root: string, value: unknown) {
  const lens = requireRecord(value, 'latitude-belt map lens'), path = requireString(lens.path, 'path');
  const column = requireFiniteNumber(lens.column, 'column');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError(`${path}: a belt map must be inside the source directory.`);
  if (!Number.isInteger(column) || column < 3) throw new TypeError(`${path}: column ${column} is not a value column (columns 1 and 2 are latitude and longitude).`);
  const scale = lens.valueTransform === undefined ? 1 : requireFiniteNumber(requireRecord(lens.valueTransform, 'valueTransform').scale, 'valueTransform.scale');
  const outlines = lens.outlineLatitudes === undefined ? [] : requireArray(lens.outlineLatitudes, 'outlineLatitudes').map(v => requireFiniteNumber(v, 'outline latitude'));
  const belts = parseLatitudeBelts(await readFile(resolve(root, path), 'utf8'), path, column);
  const around = (belt: { values: number[] }, longitude: number) => {
    const n = belt.values.length, x = ((((longitude % 360) + 360) % 360) * n / 360 - 0.5 + n) % n;
    const k = Math.floor(x), dx = x - k;
    return belt.values[k]! * (1 - dx) + belt.values[(k + 1) % n]! * dx;
  };
  const values = belts.flatMap(belt => belt.values);
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const north = belts.findIndex(belt => belt.latitude >= latitude);
      if (north === 0) return around(belts[0]!, longitude) * scale;
      if (north === -1) return around(belts.at(-1)!, longitude) * scale;
      const lower = belts[north - 1]!, upper = belts[north]!, dy = (latitude - lower.latitude) / (upper.latitude - lower.latitude);
      return (around(lower, longitude) * (1 - dy) + around(upper, longitude) * dy) * scale;
    },
    ...(outlines.length ? { outline(_longitude: number, latitude: number, pixelDegrees: number) {
      return outlines.some(limit => Math.abs(latitude - limit) <= pixelDegrees / 2);
    } } : {}),
    report: { format: 'latitude-belt-map', column, belts: belts.length, cells: values.length, minimum: Math.min(...values) * scale, maximum: Math.max(...values) * scale, outlineLatitudes: outlines },
  };
}
