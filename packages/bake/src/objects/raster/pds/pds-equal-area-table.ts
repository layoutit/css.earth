/**
 * A PDS3 ASCII table of equal-area map pixels: one row per pixel with its latitude and longitude bounds, as the Lunar
 * Prospector GRS elemental-abundance release (LP-L-GRS-5-ELEM-ABUNDANCE-V1.0) stores its 2, 5 and 20 degree maps.
 * Latitude bands have equal height and each band splits into as many equal longitude pixels as keeps pixel areas
 * about equal, so the table is not a regular grid.
 *
 * Columns are read at the START_BYTE and BYTES the detached format file (^STRUCTURE) gives them, never by splitting on
 * separators: that release's readme says commas separate its fields, while its tables separate them with spaces. A label
 * that describes its COLUMN objects inline, as the Dawn GRaND Ceres maps (DWNCGRD_2) do, is read the same way with no
 * format file; a COLUMN without COLUMN_NUMBER takes its place in the label, as PDS3 allows. The
 * pixels must tile the sphere exactly as printed: bands meet edge to edge from -90 to 90, and every band's pixels meet
 * edge to edge from its first to its last longitude, 360 degrees apart. Each cell keeps its archived value; a point
 * takes the value of the pixel whose bounds contain it, and nothing is interpolated. The release declares no missing
 * constant, so a recipe may name one only with the producer's evidence.
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { pds3Keyword } from '@cssearth/telescope';

interface Column { number: number; name: string; start: number; bytes: number; description: string | undefined }
interface Band { south: number; north: number; west: number; edges: Float64Array; first: number }

const unquote = (raw: string | undefined) => raw?.replace(/^"|"$/gu, '').replace(/\s+/gu, ' ').trim();

/** The COLUMN objects of a PDS3 format file or label, in file order. */
export function pdsTableColumns(structure: string, where: string): Column[] {
  const blocks = [...structure.matchAll(/^\s*OBJECT\s*=\s*COLUMN\s*$([\s\S]*?)^\s*END_OBJECT\s*=\s*COLUMN\s*$/gmu)].map(match => match[1]!);
  return blocks.map((block, index) => {
    const field = (key: string) => {
      const raw = pds3Keyword(block, key);
      if (raw === undefined) throw new Error(`${where}: column ${index + 1} has no ${key}.`);
      return raw;
    };
    const numbered = pds3Keyword(block, 'COLUMN_NUMBER');
    const column = { number: numbered === undefined ? index + 1 : Number(numbered), name: unquote(field('NAME'))!, start: Number(field('START_BYTE')),
      bytes: Number(field('BYTES')), description: unquote(pds3Keyword(block, 'DESCRIPTION')) };
    if (column.number !== index + 1 || ![column.start, column.bytes].every(n => Number.isSafeInteger(n) && n > 0)) {
      throw new Error(`${where}: column ${index + 1} (${column.name}) has COLUMN_NUMBER ${column.number}, START_BYTE ${column.start}, BYTES ${column.bytes}.`);
    }
    return column;
  });
}

export interface EqualAreaTablePolicy {
  datasetId: string; productId: string; column: string; columnDescription: string;
  errorColumn?: string; noData?: number; noDataEvidence?: string;
}

/** Decode the pixel bounds and one value column, and check that the pixels tile the sphere. A null structure name reads the
 * COLUMN objects from the label itself, which must then carry no ^STRUCTURE pointer. */
export function parsePdsEqualAreaTable(label: string, structure: string, structureName: string | null, text: string, policy: EqualAreaTablePolicy, where: string) {
  const field = (key: string) => {
    const raw = pds3Keyword(label, key);
    if (raw === undefined) throw new Error(`${where}: PDS3 label has no ${key}.`);
    return unquote(raw)!;
  };
  const columns = pdsTableColumns(structureName === null ? label : structure, `${where} ${structureName ?? 'label'}`);
  const pointer = pds3Keyword(label, '^STRUCTURE');
  const rows = Number(field('ROWS')), rowBytes = Number(field('ROW_BYTES'));
  const named = (name: string) => columns.find(column => column.name === name);
  const bounds = ['PIXEL_INDEX', 'MIN_LAT', 'MAX_LAT', 'MIN_LON', 'MAX_LON'].map(named);
  const value = named(policy.column), error = policy.errorColumn === undefined ? undefined : named(policy.errorColumn);
  const problems = [
    field('PDS_VERSION_ID') !== 'PDS3' && 'PDS_VERSION_ID',
    field('DATA_SET_ID') !== policy.datasetId && `DATA_SET_ID ${field('DATA_SET_ID')}, recipe ${policy.datasetId}`,
    field('PRODUCT_ID') !== policy.productId && `PRODUCT_ID ${field('PRODUCT_ID')}, recipe ${policy.productId}`,
    field('INTERCHANGE_FORMAT') !== 'ASCII' && `INTERCHANGE_FORMAT ${field('INTERCHANGE_FORMAT')}`,
    structureName === null ? pointer !== undefined && `^STRUCTURE ${pointer}, but the recipe reads inline columns`
      : unquote(pointer)?.toUpperCase() !== structureName.toUpperCase() && `^STRUCTURE ${String(pointer)}, recipe ${structureName}`,
    Number(field('COLUMNS')) !== columns.length && `COLUMNS ${field('COLUMNS')} but ${structureName ?? 'the label'} describes ${columns.length}`,
    !(Number.isSafeInteger(rows) && rows > 0 && rows <= 1_000_000) && `ROWS ${field('ROWS')}`,
    bounds.some(column => column === undefined) && 'PIXEL_INDEX, MIN_LAT, MAX_LAT, MIN_LON or MAX_LON column missing',
    bounds.slice(1).some(column => column !== undefined && column.description === undefined) && 'a bound column without DESCRIPTION',
    !value && `no column ${policy.column}`,
    value && value.description !== policy.columnDescription && `${policy.column} DESCRIPTION "${value.description}", recipe "${policy.columnDescription}"`,
    policy.errorColumn !== undefined && !error && `no error column ${policy.errorColumn}`,
    columns.some(column => column.start + column.bytes - 1 > rowBytes - 2) && `a column ends past ROW_BYTES ${rowBytes} less its CR LF`,
    policy.noData !== undefined && !policy.noDataEvidence && 'recipe noData without noDataEvidence while the label declares none',
  ].filter(Boolean);
  if (problems.length) throw new Error(`${where}: PDS equal-area table differs from its recipe: ${problems.join('; ')}.`);
  if (text.length !== rows * rowBytes) throw new Error(`${where}: ${text.length} bytes, but ROWS ${rows} x ROW_BYTES ${rowBytes} = ${rows * rowBytes}.`);
  const number = (row: string, column: Column, index: number) => {
    const raw = row.slice(column.start - 1, column.start - 1 + column.bytes).trim();
    const parsed = Number(raw);
    if (!raw || !Number.isFinite(parsed)) throw new Error(`${where}: row ${index + 1} column ${column.name} is "${raw}".`);
    return parsed;
  };
  const [indexColumn, southColumn, northColumn, westColumn, eastColumn] = bounds as Column[];
  const values = new Float64Array(rows), errors = error ? new Float64Array(rows) : null;
  const bands: Band[] = [];
  let current: { south: number; north: number; west: number; edges: number[]; first: number } | null = null;
  const close = (band: typeof current) => {
    if (!band) return;
    if (Math.abs(band.edges.at(-1)! - band.west - 360) > 1e-9) throw new Error(`${where}: band ${band.south} to ${band.north} spans ${band.west} to ${band.edges.at(-1)}, not 360 degrees.`);
    bands.push({ south: band.south, north: band.north, west: band.west, edges: Float64Array.from(band.edges), first: band.first });
  };
  for (let i = 0; i < rows; i++) {
    const row = text.slice(i * rowBytes, (i + 1) * rowBytes);
    if (!row.endsWith('\r\n')) throw new Error(`${where}: row ${i + 1} does not end with CR LF at ROW_BYTES ${rowBytes}.`);
    const index = number(row, indexColumn, i), south = number(row, southColumn, i), north = number(row, northColumn, i);
    const west = number(row, westColumn, i), east = number(row, eastColumn, i);
    if (index !== i) throw new Error(`${where}: row ${i + 1} has PIXEL_INDEX ${index}; pixels must be listed in index order.`);
    if (!(south < north && west < east && south >= -90 && north <= 90)) throw new Error(`${where}: pixel ${i} bounds ${south} to ${north}, ${west} to ${east}.`);
    if (!current || south !== current.south || north !== current.north) {
      close(current);
      const expectedSouth = bands.at(-1)?.north ?? -90;
      if (south !== expectedSouth) throw new Error(`${where}: pixel ${i} starts a band at ${south}, expected ${expectedSouth}.`);
      current = { south, north, west, edges: [east], first: i };
    } else {
      if (west !== current.edges.at(-1)) throw new Error(`${where}: pixel ${i} starts at ${west}, expected ${current.edges.at(-1)}.`);
      current.edges.push(east);
    }
    const v = number(row, value!, i);
    values[i] = policy.noData !== undefined && v === policy.noData ? NaN : v;
    if (errors) errors[i] = number(row, error!, i);
  }
  close(current);
  if (bands.at(-1)?.north !== 90) throw new Error(`${where}: the last band ends at ${bands.at(-1)?.north}, not 90.`);
  return { values, errors, bands, rows };
}

/** The pixel containing a point: bounds include their south and west edges; the north pole and the band's east end
 * belong to the last band and pixel. */
export function equalAreaPixel(bands: readonly Band[], longitude: number, latitude: number) {
  let low = 0, high = bands.length - 1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (bands[mid]!.south <= latitude) low = mid; else high = mid - 1; }
  const band = bands[low]!;
  const lon = band.west + ((((longitude - band.west) % 360) + 360) % 360);
  let a = 0, b = band.edges.length - 1;
  while (a < b) { const mid = (a + b) >> 1; if (band.edges[mid]! > lon) b = mid; else a = mid + 1; }
  return band.first + a;
}

/** Parse the lens and decode its table, for preparation and for tests. */
export async function loadPdsEqualAreaTable(root: string, value: unknown) {
  const lens = requireRecord(value, 'pds-equal-area-table lens');
  const path = requireString(lens.path, 'pds-equal-area-table lens path');
  const labelPath = requireString(lens.labelPath, `${path} labelPath`);
  const structurePath = lens.structurePath === undefined ? null : requireString(lens.structurePath, `${path} structurePath`);
  for (const file of [path, labelPath, ...(structurePath === null ? [] : [structurePath])]) if (file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) throw new Error(`${path}: ${file} escapes the source directory.`);
  if (lens.sampling !== undefined && lens.sampling !== 'nearest') throw new TypeError(`${path}: equal-area pixels require nearest sampling.`);
  const policy: EqualAreaTablePolicy = {
    datasetId: requireString(lens.datasetId, `${path} datasetId`), productId: requireString(lens.productId, `${path} productId`),
    column: requireString(lens.column, `${path} column`), columnDescription: requireString(lens.columnDescription, `${path} columnDescription`),
    ...(lens.errorColumn === undefined ? {} : { errorColumn: requireString(lens.errorColumn, `${path} errorColumn`) }),
    ...(lens.noData === undefined ? {} : { noData: requireFiniteNumber(lens.noData, `${path} noData`), noDataEvidence: requireString(lens.noDataEvidence, `${path} noDataEvidence`) }),
  };
  const where = `${path} ${policy.column}`;
  const [label, structure, text] = await Promise.all([labelPath, structurePath ?? labelPath, path].map(file => readFile(resolve(root, file), 'latin1')));
  const table = parsePdsEqualAreaTable(label!, structure!, structurePath === null ? null : basename(structurePath), text!, policy, where);
  const transform = lens.valueTransform === undefined ? null : requireRecord(lens.valueTransform, `${where} valueTransform`);
  const scale = transform ? requireFiniteNumber(transform.scale, `${where} valueTransform.scale`) : 1;
  const offset = transform ? requireFiniteNumber(transform.offset, `${where} valueTransform.offset`) : 0;
  let mapped = 0, lowest = Infinity, highest = -Infinity;
  for (const v of table.values) if (Number.isFinite(v)) { mapped += 1; lowest = Math.min(lowest, v); highest = Math.max(highest, v); }
  const sigmas = table.errors ? [...table.errors].filter(e => e >= 0).map(Math.sqrt).sort((a, b) => a - b) : [];
  return {
    report: { format: 'pds-equal-area-table', pixels: table.rows, bands: table.bands.length, mappedPixels: mapped,
      valueRange: mapped ? [lowest * scale + offset, highest * scale + offset] : null, sampling: 'containing-pixel',
      ...(sigmas.length ? { medianSigma: sigmas[sigmas.length >> 1]! * scale, negativeVariances: table.errors!.length - sigmas.length } : {}) },
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const v = table.values[equalAreaPixel(table.bands, longitude, latitude)]!;
      return Number.isFinite(v) ? v * scale + offset : null;
    },
  };
}

/** Files the lens reads besides its table, so preparation can require each to be declared in the manifest. */
export function pdsEqualAreaTableDependencies(value: unknown) {
  const lens = requireRecord(value);
  return [lens.labelPath, lens.structurePath].filter((path): path is string => typeof path === 'string');
}
