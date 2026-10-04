/** A complete periodic longitude/latitude grid selected from a numeric CSV table.
 * Columns are one-based; `slice` selects an exact released level, without vertical
 * interpolation. Coordinates are east-positive degrees. Latitude is bounded by
 * the actual samples: missing polar rows are not extrapolated. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { periodicLonLatGrid } from './lonlat/lonlat-grid.ts';

export function parseLonLatSliceTable(text: string, value: unknown) {
  const dataset = requireRecord(value, 'longitude/latitude table');
  const columns = requireRecord(dataset.columns, 'columns'), slice = requireRecord(dataset.slice, 'slice');
  const column = (n: unknown) => {
    const v = requireFiniteNumber(n, 'column');
    if (!Number.isSafeInteger(v) || v < 1) throw new TypeError('Table columns must be positive one-based integers.');
    return v - 1;
  };
  const lonColumn = column(columns.longitude), latColumn = column(columns.latitude), dataColumn = column(columns.value), sliceColumn = column(slice.column);
  if (new Set([lonColumn, latColumn, dataColumn, sliceColumn]).size !== 4) throw new TypeError('Table columns must be distinct.');
  const level = requireFiniteNumber(slice.value, 'slice.value');
  const tolerance = requireFiniteNumber(dataset.coordinateToleranceDegrees, 'coordinateToleranceDegrees');
  if (!(tolerance >= 0 && tolerance <= 0.01)) throw new RangeError('Coordinate tolerance must be between 0 and 0.01 degrees.');
  const rows: { lon: number; lat: number; value: number }[] = [];
  for (const [i, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const cells = line.split(',');
    if (cells.length <= Math.max(lonColumn, latColumn, dataColumn, sliceColumn) || cells.some(c => !c.trim() || !Number.isFinite(Number(c))))
      throw new TypeError(`Invalid numeric CSV row ${i + 1}.`);
    const row = cells.map(Number);
    if (row[sliceColumn] === level) rows.push({ lon: row[lonColumn]!, lat: row[latColumn]!, value: row[dataColumn]! });
  }
  const longitudes = [...new Set(rows.map(r => r.lon))].sort((a, b) => a - b);
  const latitudes = [...new Set(rows.map(r => r.lat))].sort((a, b) => a - b);
  if (longitudes.length < 2 || latitudes.length < 2) throw new TypeError(`Slice ${level} does not contain a longitude/latitude grid.`);
  const lonIndex = new Map(longitudes.map((n, i) => [n, i])), latIndex = new Map(latitudes.map((n, i) => [n, i]));
  const grid = new Float64Array(longitudes.length * latitudes.length).fill(NaN);
  const sampler = periodicLonLatGrid(longitudes, latitudes, grid, tolerance);
  for (const row of rows) {
    const index = latIndex.get(row.lat)! * longitudes.length + lonIndex.get(row.lon)!;
    if (Number.isFinite(grid[index])) throw new TypeError(`Duplicate grid cell at ${row.lon}, ${row.lat}.`);
    grid[index] = row.value;
  }
  if (grid.some(n => !Number.isFinite(n))) throw new TypeError('Slice has missing grid cells.');
  return {
    sample: sampler.sample,
    report: { format: 'lonlat-slice-table', slice: { column: sliceColumn + 1, value: level }, columns,
      width: longitudes.length, height: latitudes.length, longitudeRange: [longitudes[0], longitudes.at(-1)],
      latitudeRange: [latitudes[0], latitudes.at(-1)], minimum: grid.reduce((a, b) => Math.min(a, b), Infinity), maximum: grid.reduce((a, b) => Math.max(a, b), -Infinity),
      polarCoverage: 'No extrapolation beyond the released latitude samples.' },
  };
}

export async function loadLonLatSliceTable(root: string, value: unknown) {
  const path = requireString(requireRecord(value).path, 'path');
  if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) throw new TypeError('A table must be inside the source directory.');
  return parseLonLatSliceTable(await readFile(resolve(root, path), 'utf8'), value);
}
