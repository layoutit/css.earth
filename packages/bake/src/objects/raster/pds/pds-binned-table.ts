/** PDS3 latitude/longitude bin tables. Some releases use tab-separated rows despite fixed-width labels;
 * read the declared column order, preserving the estimates (including negative values), errors and missing bins. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { pds3Keyword } from '@cssearth/telescope';

export function parsePdsBinnedTable(label: string, text: string, binDegrees: number, quantity: string, units: string) {
  const field = (key: string) => pds3Keyword(label, key);
  const columns = [...label.matchAll(/OBJECT\s*=\s*COLUMN\s*([\s\S]*?)END_OBJECT\s*=\s*COLUMN/gu)].map(match => {
    const column = match[1]!;
    return { name: pds3Keyword(column, 'NAME'), unit: pds3Keyword(column, 'UNIT'),
      number: Number(pds3Keyword(column, 'COLUMN_NUMBER')), noData: Number(pds3Keyword(column, 'NOT_APPLICABLE_CONSTANT')) };
  });
  const width = 360 / binDegrees, height = 180 / binDegrees;
  if (field('PDS_VERSION_ID') !== 'PDS3' || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      binDegrees <= 0 || width * height > 1_000_000 || Number(field('ROWS')) !== width * height ||
      Number(field('COLUMNS')) !== columns.length || columns.some((column, i) => column.number !== i + 1) ||
      columns[0]?.name !== 'LATITUDE' || columns[1]?.name !== 'LONGITUDE' ||
      columns[0]?.unit !== 'DEGREE' || columns[1]?.unit !== 'DEGREE') throw new Error('PDS bin layout differs from the recipe.');
  const valueColumn = columns.findIndex(column => column.name === quantity);
  const errorColumn = columns.findIndex(column => column.name === 'SIGMA');
  const totalErrorColumn = columns.findIndex(column => column.name === 'SIGMA WITH CFS');
  if (valueColumn < 2 || errorColumn < 2 || totalErrorColumn < 2 ||
      [valueColumn, errorColumn, totalErrorColumn].some(i => columns[i]!.unit !== units || !Number.isFinite(columns[i]!.noData))) {
    throw new Error('PDS concentration or error columns differ from the recipe.');
  }
  const rows = text.trim().split(/\r?\n/u).map(line => line.trim().split(/\s+/u).map(Number));
  if (rows.length !== width * height) throw new Error('Incomplete PDS bin table.');
  const values = new Float64Array(rows.length), errors = new Float64Array(rows.length), totalErrors = new Float64Array(rows.length);
  let valid = 0, minimum = Infinity, maximum = -Infinity;
  rows.forEach((row, i) => {
    if (row.length !== columns.length || row.some(v => !Number.isFinite(v)) ||
        row[0] !== -90 + (Math.floor(i / width) + .5) * binDegrees || row[1] !== (i % width + .5) * binDegrees) {
      throw new Error(`PDS bin coordinates or values changed at row ${i + 1}.`);
    }
    for (const [target, column] of [[values, valueColumn], [errors, errorColumn], [totalErrors, totalErrorColumn]] as const) {
      target[i] = row[column] === columns[column]!.noData ? NaN : row[column]!;
    }
    if (Number.isFinite(values[i])) { valid++; minimum = Math.min(minimum, values[i]!); maximum = Math.max(maximum, values[i]!); }
  });
  return { width, height, values, errors, totalErrors, valid, minimum, maximum };
}

export async function loadPdsBinnedTable(root: string, value: unknown) {
  const recipe = requireRecord(value, 'PDS bin recipe');
  const path = requireString(recipe.path, 'path'), labelPath = requireString(recipe.labelPath, 'labelPath');
  for (const file of [path, labelPath]) if (file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) throw new Error('PDS table path escapes the source directory.');
  const binDegrees = requireFiniteNumber(recipe.binDegrees, 'binDegrees'), units = requireString(recipe.sourceUnits, 'sourceUnits');
  const table = parsePdsBinnedTable(await readFile(resolve(root, labelPath), 'utf8'), await readFile(resolve(root, path), 'utf8'),
    binDegrees, requireString(recipe.column, 'column'), units);
  const factor = recipe.scale === undefined ? 1 : requireFiniteNumber(recipe.scale, 'scale');
  return {
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const x = Math.floor(((longitude % 360 + 360) % 360) / binDegrees), y = Math.min(table.height - 1, Math.floor((latitude + 90) / binDegrees));
      const sample = table.values[y * table.width + x]!;
      return Number.isFinite(sample) ? sample * factor : null;
    },
    report: { format: 'pds-binned-table', binDegrees, sourceUnits: units, scale: factor, validBins: table.valid,
      minimum: table.minimum * factor, maximum: table.maximum * factor, uncertainty: 'SIGMA and SIGMA WITH CFS retained in the original table; absent correction-factor errors do not invalidate a measured concentration.' },
  };
}
