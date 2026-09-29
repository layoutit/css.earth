/**
 * Offline intake of the Dawn GRaND Vesta derived maps (PDS4 bundle urn:nasa:pds:dawn-grand-vesta) into the existing
 * `npy-lonlat-grid` scientific input. Run from the repository root after restoring the tables:
 *
 *   node packages/bake/authoring/vesta-grand/prepare-grids.mts
 *
 * Each archived pixel keeps its value exactly. Pixels are placed by the table's own MIN/MAX latitude and longitude
 * columns (the row order starts at -30 E, not at the label's -180 E), moved 210 degrees from Claudia Double Prime into
 * the Dawn Claudia frame of the other Vesta maps, and expanded onto a regular grid whose steps divide every published
 * pixel boundary. A product gives one `stepDegrees`, or `latitudeStepDegrees` and `longitudeStepDegrees` when its
 * latitude bands are much coarser than its longitude boundaries. The script refuses a pixel that straddles a grid cell, a cell covered twice, or an uncovered cell, so
 * the grid is a lossless re-indexing of the table. Nothing is interpolated, smoothed or filled.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Tables, labels, plan and grids live beside Vesta's other inputs.
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/objects/vesta/source/grand');

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string) {
  if (typeof value !== 'string' || !value || value.includes('/') || value.includes('\\')) throw new TypeError(`${label} must be a file name in ${directory}.`);
  return value;
}
function number(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}

interface Field { name: string; location: number; length: number; unit: string | null }

/** Read the fixed-width field table from the PDS4 label. */
function readLabel(xml: string, path: string) {
  const fields: Field[] = [...xml.matchAll(/<Field_Character>([\s\S]*?)<\/Field_Character>/gu)].map(match => {
    const body = match[1]!;
    const tag = (name: string) => body.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`, 'u'))?.[1]?.trim() ?? null;
    return { name: tag('name') ?? '', location: Number(tag('field_location')), length: Number(tag('field_length')), unit: tag('unit') };
  });
  const records = Number(xml.match(/<Table_Character>[\s\S]*?<records>(\d+)<\/records>/u)?.[1]);
  const recordLength = Number(xml.match(/<record_length unit="byte">(\d+)<\/record_length>/u)?.[1]);
  if (!fields.length || !Number.isSafeInteger(records) || !Number.isSafeInteger(recordLength) ||
      fields.some(field => !field.name || !Number.isSafeInteger(field.location) || !Number.isSafeInteger(field.length))) {
    throw new Error(`${path}: the label does not describe a fixed-width character table.`);
  }
  return { fields, records, recordLength };
}

function npy(values: Float64Array, shape: readonly number[]) {
  let header = `{'descr': '<f8', 'fortran_order': False, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`;
  header = header.padEnd(Math.ceil((10 + header.length + 1) / 64) * 64 - 10 - 1, ' ') + '\n';
  const prefix = Buffer.alloc(10);
  prefix.write('\x93NUMPY', 0, 'latin1'); prefix[6] = 1; prefix[7] = 0; prefix.writeUInt16LE(header.length, 8);
  const body = Buffer.alloc(values.length * 8);
  values.forEach((value, i) => body.writeDoubleLE(value, i * 8));
  return Buffer.concat([prefix, Buffer.from(header, 'latin1'), body]);
}

const plan = record(JSON.parse(readFileSync(resolve(directory, 'prepare-grids.json'), 'utf8')), 'prepare-grids.json');
if (plan.schema !== 'cssearth-vesta-grand-grids@1') throw new TypeError('prepare-grids.json has an unexpected schema.');
const shift = number(record(plan.frame, 'frame').claudiaMinusSourceLongitudeDegrees, 'frame.claudiaMinusSourceLongitudeDegrees');
if (!Array.isArray(plan.products)) throw new TypeError('prepare-grids.json products must be a list.');

const report: Record<string, unknown>[] = [];
for (const entry of plan.products) {
  const product = record(entry, 'product');
  const id = String(product.id), tablePath = text(product.table, `${id}.table`), labelPath = text(product.label, `${id}.label`);
  const latStep = number(product.latitudeStepDegrees ?? product.stepDegrees, `${id}.latitudeStepDegrees`);
  const lonStep = number(product.longitudeStepDegrees ?? product.stepDegrees, `${id}.longitudeStepDegrees`);
  const width = 360 / lonStep, height = 180 / latStep;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new Error(`${id}: steps ${latStep} x ${lonStep} do not divide the sphere.`);
  const bytes = readFileSync(resolve(directory, tablePath));
  const label = readLabel(readFileSync(resolve(directory, labelPath), 'utf8'), labelPath);
  if (label.records !== product.records || bytes.length !== label.records * label.recordLength) {
    throw new Error(`${id}: ${tablePath} has ${bytes.length} bytes; the label states ${label.records} records of ${label.recordLength}.`);
  }
  const column = (name: string, unit: string | null) => {
    const field = label.fields.find(candidate => candidate.name === name);
    if (!field || field.unit !== unit) throw new Error(`${id}: ${labelPath} field ${name} is missing or not in ${String(unit)} (found ${String(field?.unit)}).`);
    return (row: Buffer) => {
      const value = Number(row.subarray(field.location - 1, field.location - 1 + field.length).toString('latin1').trim());
      if (!Number.isFinite(value)) throw new Error(`${id}: ${tablePath} field ${name} is not numeric.`);
      return value;
    };
  };
  const minLat = column('MIN_LAT', 'degree'), maxLat = column('MAX_LAT', 'degree'), minLon = column('MIN_LON', 'degree');
  const deltaLon = column('DELTA_LON', 'degree'), quantity = column(text(product.field, `${id}.field`), String(product.unit));
  const grid = new Float64Array(width * height).fill(NaN);
  let minimum = Infinity, maximum = -Infinity, zeros = 0;
  for (let i = 0; i < label.records; i++) {
    const row = bytes.subarray(i * label.recordLength, (i + 1) * label.recordLength);
    const south = minLat(row), north = maxLat(row), west = minLon(row), span = deltaLon(row), value = quantity(row);
    const cells = [(south + 90) / latStep, (north + 90) / latStep, (west + 180) / lonStep, span / lonStep];
    if (cells.some(cell => !Number.isInteger(cell)) || south < -90 || north > 90 || north <= south || span <= 0) {
      throw new Error(`${id}: record ${i} (${south}..${north} N, ${west} E + ${span}) does not tile the ${latStep} x ${lonStep} degree grid.`);
    }
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); if (value === 0) zeros++;
    for (let y = cells[0]!; y < cells[1]!; y++) for (let k = 0; k < cells[3]!; k++) {
      // Source column in Claudia Double Prime from -180 E, moved into Claudia columns from 0 E.
      const claudiaWest = west + k * lonStep + shift;
      const x = Math.round((((claudiaWest % 360) + 360) % 360) / lonStep);
      if (Number.isFinite(grid[y * width + x]!)) throw new Error(`${id}: record ${i} overlaps an earlier pixel at row ${y}, column ${x}.`);
      grid[y * width + x] = value;
    }
  }
  const empty = grid.reduce((count, value) => count + (Number.isFinite(value) ? 0 : 1), 0);
  if (empty) throw new Error(`${id}: ${empty} grid cells have no archived pixel.`);
  const longitudes = Float64Array.from({ length: width }, (_, x) => (x + 0.5) * lonStep);
  const latitudes = Float64Array.from({ length: height }, (_, y) => -90 + (y + 0.5) * latStep);
  writeFileSync(resolve(directory, text(product.longitudes, `${id}.longitudes`)), npy(longitudes, [width]));
  writeFileSync(resolve(directory, text(product.values, `${id}.values`)), npy(grid, [height, width]));
  writeFileSync(resolve(directory, text(product.latitudes, `${id}.latitudes`)), npy(latitudes, [height]));
  report.push({ id, records: label.records, width, height, minimum, maximum, zeros, unit: product.unit,
    longitudeNodes: [longitudes[0], longitudes[width - 1]], frame: `Claudia = Claudia Double Prime + ${shift}` });
}
console.log(JSON.stringify(report, null, 2));
