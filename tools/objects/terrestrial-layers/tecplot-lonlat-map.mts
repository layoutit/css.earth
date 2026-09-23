/** A surface map deposited as a Tecplot ASCII table on a longitude-latitude grid, as ZDI codes write their magnetic maps:
 *
 * - `tecplot-lonlat-map`: `path` names the .dat file and `variable` the column drawn, exactly as the file's VARIABLES line names it.
 *   The first two variables must be longitude and latitude in degrees; the ZONE line gives the grid's I (longitude) and J
 *   (latitude) node counts, DATAPACKING=POINT with longitude varying fastest.
 *
 * The nodes are checked to form a regular grid from longitude 0 to 360 and latitude -90 to 90, both ends included; the map is
 * bilinear between nodes, so every node keeps its deposited value. `outlineLatitudes` (optional) are drawn as thin black lines, for
 * a limit the paper draws on its maps, such as the latitude the star never turns toward us. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

export function parseTecplotLonLat(text: string, path: string) {
  const variables = text.match(/^\s*VARIABLES\s*=\s*(.*)$/mu)?.[1]?.match(/"([^"]*)"/gu)?.map(name => name.slice(1, -1));
  const zone = text.match(/^\s*ZONE\s+I\s*=\s*(\d+)\s*,\s*J\s*=\s*(\d+)/mu);
  if (!variables || variables.length < 3 || !zone) throw new TypeError(`${path}: a Tecplot map needs VARIABLES and a ZONE with I and J.`);
  if (!/^DATAPACKING\s*=\s*POINT/mu.test(text.replace(/^\s+/gmu, ''))) throw new TypeError(`${path}: only DATAPACKING=POINT is read.`);
  if (!/^Longitude/iu.test(variables[0]!) || !/^Latitude/iu.test(variables[1]!)) throw new TypeError(`${path}: the first two variables must be longitude and latitude, not ${variables.slice(0, 2).join(', ')}.`);
  const columns = Number(zone[1]), rows = Number(zone[2]);
  const values = text.split('\n').filter(line => /^\s*[-+\d.]/u.test(line)).map((line, i) => {
    const row = line.trim().split(/\s+/u).map(Number);
    if (row.length !== variables.length || row.some(v => !Number.isFinite(v))) throw new TypeError(`${path}: data row ${i + 1} does not hold ${variables.length} numbers.`);
    return row;
  });
  if (values.length !== columns * rows) throw new TypeError(`${path}: ${values.length} rows for a ${columns} x ${rows} zone.`);
  const lonStep = 360 / (columns - 1), latStep = 180 / (rows - 1);
  values.forEach((row, i) => {
    const lon = (i % columns) * lonStep, lat = -90 + Math.floor(i / columns) * latStep;
    if (Math.abs(row[0]! - lon) > 1e-3 || Math.abs(row[1]! - lat) > 1e-3) throw new TypeError(`${path}: node ${i} is at ${row[0]}, ${row[1]}, not ${lon.toFixed(4)}, ${lat.toFixed(4)}.`);
  });
  return { variables, columns, rows, lonStep, latStep, values };
}

export async function loadTecplotLonLatMap(root: string, value: unknown) {
  const lens = requireRecord(value, 'Tecplot map lens'), path = requireString(lens.path, 'path'), variable = requireString(lens.variable, 'variable');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError(`${path}: a Tecplot map must be inside the source directory.`);
  const outlines = lens.outlineLatitudes === undefined ? [] : requireArray(lens.outlineLatitudes, 'outlineLatitudes').map(v => requireFiniteNumber(v, 'outline latitude'));
  const table = parseTecplotLonLat(await readFile(resolve(root, path), 'utf8'), path);
  const column = table.variables.indexOf(variable);
  if (column < 2) throw new TypeError(`${path}: no map variable "${variable}"; it has ${table.variables.slice(2).map(v => `"${v}"`).join(', ')}.`);
  const node = (i: number, j: number) => table.values[j * table.columns + i]![column]!;
  let minimum = Infinity, maximum = -Infinity;
  for (const row of table.values) { minimum = Math.min(minimum, row[column]!); maximum = Math.max(maximum, row[column]!); }
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const x = (((longitude % 360) + 360) % 360) / table.lonStep, y = (latitude + 90) / table.latStep;
      const i = Math.min(table.columns - 2, Math.floor(x)), j = Math.min(table.rows - 2, Math.floor(y)), dx = x - i, dy = y - j;
      return node(i, j) * (1 - dx) * (1 - dy) + node(i + 1, j) * dx * (1 - dy) + node(i, j + 1) * (1 - dx) * dy + node(i + 1, j + 1) * dx * dy;
    },
    ...(outlines.length ? { outline(_longitude: number, latitude: number, pixelDegrees: number) {
      return outlines.some(limit => Math.abs(latitude - limit) <= pixelDegrees / 2);
    } } : {}),
    report: { format: 'tecplot-lonlat-map', variable, grid: { columns: table.columns, rows: table.rows, stepDegrees: [table.lonStep, table.latStep] }, minimum, maximum, outlineLatitudes: outlines },
  };
}
