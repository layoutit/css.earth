import {parseRadialTableProfile} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { parsePdsRadiusTable } from './obj-shape.mts';

export function validateRadialTableProfile(value: unknown) {
  const profile=parseRadialTableProfile(value);
  const { latitudeStepDegrees: lat, longitudeStepDegrees: lon, metersPerUnit, expectedRecords } = profile ?? {};
  const columns = profile?.columns ?? ['latitude', 'longitude', 'radius'];
  if (!(lat > 0 && lat <= 90) || !(lon > 0 && lon <= 180) ||
      !Number.isInteger(180 / lat) || !Number.isInteger(360 / lon) ||
      !(metersPerUnit > 0) || !Number.isFinite(metersPerUnit) ||
      expectedRecords !== (180 / lat + 1) * (360 / lon + 1) || expectedRecords > 1000000 ||
      !['east', 'west'].includes(profile.longitudeDirection) ||
      !Array.isArray(columns) || columns.length !== 3 ||
      ['latitude', 'longitude', 'radius'].some(name => !columns.includes(name)) ||
      (profile.noDataRadius !== undefined && !(Number.isFinite(profile.noDataRadius) && profile.noDataRadius > 0))) {
    throw new TypeError('Invalid PDS radial table grid.');
  }
  return { width: 360 / lon + 1, height: 180 / lat + 1, columns };
}

/** Released latitude/longitude/radius tables. Keep the source values and seam;
 * reject missing cells or inconsistent poles rather than inventing a closure. */
export async function loadPdsRadialTable(path: string, profile: unknown) {
  return parsePdsRadialTable(await readFile(path, 'utf8'), profile);
}

/** The released table as a source mesh: its latitude-first rows reordered onto the radius-table grid, so a closest source point can be
 * found on it. The height field above stays the sampler for radial resampling. */
export async function loadPdsRadialTableMesh(path: string, value: unknown) {
  const text = await readFile(path, 'utf8'), grid = parsePdsRadialTable(text, value), profile = parseRadialTableProfile(value);
  if (profile.latitudeStepDegrees !== profile.longitudeStepDegrees) throw new Error('A radial table mesh requires equal angular steps.');
  const columns = profile.columns ?? ['latitude', 'longitude', 'radius'];
  const reordered = text.trim().split(/\r?\n/).map(line => { const row = line.trim().split(/\s+/); return ['longitude', 'latitude', 'radius'].map(name => row[columns.indexOf(name)]).join(' '); }).join('\n');
  return parsePdsRadiusTable(reordered, { stepDegrees: profile.latitudeStepDegrees, longitudeDirection: `${profile.longitudeDirection}-positive`, metersPerUnit: profile.metersPerUnit,
    expectedVertices: (grid.width - 1) * (grid.height - 2) + 2, expectedFaces: 2 * (grid.width - 1) * (grid.height - 2) });
}

export function parsePdsRadialTable(text: string, value: unknown) {
  const profile=parseRadialTableProfile(value);
  const { width, height, columns } = validateRadialTableProfile(profile);
  const records = text.trim().split(/\r?\n/), values = new Float64Array(width * height).fill(NaN);
  if (records.length !== profile.expectedRecords) throw new Error('PDS radial table record count changed.');
  for (const record of records) {
    const fields = record.trim().split(/\s+/).map(Number);
    if (fields.length !== 3 || !fields.every(Number.isFinite)) throw new Error('Invalid PDS radial table row.');
    const latitude = fields[columns.indexOf('latitude')], longitude = fields[columns.indexOf('longitude')];
    const radius = fields[columns.indexOf('radius')];
    const x = longitude / profile.longitudeStepDegrees, y = (90 - latitude) / profile.latitudeStepDegrees;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height ||
        !(radius > 0) || Number.isFinite(values[y * width + x])) throw new Error('PDS radial table has an invalid or duplicate cell.');
    values[y * width + x] = radius;
  }
  for (let y = 0; y < height; y++) {
    if (values[y * width] !== values[(y + 1) * width - 1]) throw new Error('PDS radial table seam does not close.');
    for (let x = 0; x < width; x++) {
      if (!Number.isFinite(values[y * width + x])) throw new Error('PDS radial table has missing cells.');
      if ((y === 0 || y === height - 1) && values[y * width + x] !== values[y * width]) {
        throw new Error('PDS radial table pole is inconsistent.');
      }
    }
  }
  return { width, height, values, metadata: { ...profile }, sample(longitude: number, latitude: number) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
    const signed = profile.longitudeDirection === 'west' ? -longitude : longitude;
    const x = ((signed % 360 + 360) % 360) / profile.longitudeStepDegrees;
    const y = (90 - latitude) / profile.latitudeStepDegrees;
    const x0 = Math.floor(x), x1 = x0 + 1, y0 = Math.floor(y), y1 = Math.min(y0 + 1, height - 1);
    const four = [values[y0 * width + x0], values[y0 * width + x1], values[y1 * width + x0], values[y1 * width + x1]];
    if (four.some(value => value === profile.noDataRadius)) return null;
    const dx = x - x0, dy = y - y0;
    return (four[0] * (1 - dx) * (1 - dy) + four[1] * dx * (1 - dy) +
      four[2] * (1 - dx) * dy + four[3] * dx * dy) * profile.metersPerUnit;
  } };
}
