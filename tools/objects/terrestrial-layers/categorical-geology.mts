import type {GeologyPolygon} from './contracts.mts';
import {parseGeologyLens,parsePolygonGrid} from './source-records.mts';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const localPath = (path: unknown): path is string => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split('/').includes('..');

/** The recipe binds archival symbols, not an ordinal or interpolated scale. */
export function validateGeologyProfile(value: unknown) {
  const lens=parseGeologyLens(value);
  const grid = lens.grid;
  if (lens.format !== 'geologic-shapefile' || !localPath(lens.path) || !grid ||
      !localPath(grid.attributePath) || !localPath(grid.projectionPath) ||
      typeof grid.coordinateSystem !== 'string' || !grid.coordinateSystem.startsWith('GCS_') ||
      !(grid.referenceRadiusMeters > 0) || grid.longitudeDirection !== 'east-positive' ||
      grid.latitudeType !== 'planetocentric' || grid.longitudeDomain?.join(',') !== '-180,180' ||
      !Number.isSafeInteger(grid.expectedRecords) || grid.expectedRecords < 1 ||
      !Array.isArray(grid.withheldDegenerateRings) || grid.withheldDegenerateRings.some(entry =>
        !Number.isSafeInteger(entry.record) || entry.record < 1 || entry.record > grid.expectedRecords ||
        !Number.isSafeInteger(entry.ring) || entry.ring < 0 || !Array.isArray(entry.point) || entry.point.length !== 2 || !entry.point.every(Number.isFinite)) ||
      new Set(grid.withheldDegenerateRings.map(entry => `${entry.record}/${entry.ring}`)).size !== grid.withheldDegenerateRings.length ||
      !Array.isArray(grid.expectedBounds) || grid.expectedBounds.length !== 4 || !grid.expectedBounds.every(Number.isFinite) ||
      typeof grid.field !== 'string' || !Array.isArray(grid.unknownValues) ||
      grid.unknownValues.some(value => typeof value !== 'string') ||
      lens.overlapPolicy !== 'withhold-conflicts' || lens.relief || lens.valueTransform ||
      lens.sampling !== 'nearest' || !Array.isArray(lens.categories) || lens.categories.length < 2 ||
      lens.categories.some(entry => typeof entry.value !== 'string' || !entry.value ||
        typeof entry.label !== 'string' || !entry.label || !/^#[0-9a-f]{6}$/i.test(entry.color)) ||
      new Set([...lens.categories.map(entry => entry.value), ...grid.unknownValues]).size !== lens.categories.length + grid.unknownValues.length) {
    throw new TypeError('Invalid categorical geology profile.');
  }
  return lens;
}

/** dBASE character attributes retain record order, including deleted records. */
export function decodeGeologyAttributes(bytes: Buffer) {
  if (bytes.length < 33) throw new Error('Truncated geology attributes.');
  const count = bytes.readUInt32LE(4), header = bytes.readUInt16LE(8), stride = bytes.readUInt16LE(10);
  if (header < 33 || header > bytes.length || (header - 33) % 32 || bytes[header - 1] !== 13 ||
      stride < 1 || header + count * stride > bytes.length) throw new Error('Invalid geology attribute layout.');
  const fields: {name:string;type:string;offset:number;length:number}[] = []; let offset = 1;
  for (let i = 32; i < header - 1; i += 32) {
    const name = bytes.subarray(i, i + 11).toString('ascii').split('\0')[0];
    const length = bytes[i + 16];
    if (!name || !length || fields.some(field => field.name === name)) throw new Error('Invalid geology attribute field.');
    fields.push({name, type: String.fromCharCode(bytes[i + 11]), offset, length}); offset += length;
  }
  if (offset !== stride) throw new Error('Geology attribute stride differs.');
  const rows = [];
  for (let i = 0; i < count; i++) {
    const start = header + i * stride;
    if (![32, 42].includes(bytes[start])) throw new Error('Invalid geology record flag.');
    rows.push(bytes[start] === 42 ? null : Object.fromEntries(fields.map(field => [field.name,
      bytes.subarray(start + field.offset, start + field.offset + field.length).toString('latin1').trim()])));
  }
  return {rows, fields};
}

/** ESRI Polygon rings remain planar in their declared geographic coordinates.
 * Even/odd scanlines preserve holes and split seam polygons without closing a
 * fictitious great-circle edge between -180 and +180 degrees. */
export function decodeGeologyPolygons(bytes: Buffer, value: unknown) {
  const grid=parsePolygonGrid(value);
  if (bytes.length < 100 || bytes.readInt32BE(0) !== 9994 || bytes.readInt32LE(28) !== 1000 ||
      bytes.readInt32LE(32) !== 5 || bytes.readInt32BE(24) * 2 !== bytes.length ||
      grid.expectedBounds.some((value, i) => value !== bytes.readDoubleLE(36 + i * 8))) throw new Error('Geology shape header differs.');
  const polygons: (GeologyPolygon|null)[] = [], degenerate: ReturnType<typeof parsePolygonGrid>["withheldDegenerateRings"] = []; let offset = 100;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated geology shape record.');
    const size = bytes.readInt32BE(offset + 4) * 2, start = offset + 8;
    if (bytes.readInt32BE(offset) !== polygons.length + 1 || size < 4 || start + size > bytes.length) throw new Error('Invalid geology shape record.');
    const type = bytes.readInt32LE(start);
    if (type === 0 && size === 4) polygons.push(null);
    else {
      if (type !== 5 || size < 44) throw new Error('Geology requires polygon records.');
      const parts = bytes.readInt32LE(start + 36), points = bytes.readInt32LE(start + 40);
      if (parts < 1 || points < 4 || 44 + parts * 4 + points * 16 !== size) throw new Error('Invalid geology polygon dimensions.');
      const indices = Array.from({length: parts}, (_, i) => bytes.readInt32LE(start + 44 + i * 4));
      if (indices[0] !== 0 || indices.some((v, i) => v < 0 || v >= points || i && v <= indices[i - 1])) throw new Error('Invalid geology ring offsets.');
      const rings = indices.map((index, ringIndex) => {
        const end = indices[ringIndex + 1] ?? points;
        const ring = Array.from({length: end - index}, (_, i) => {
          const position = start + 44 + parts * 4 + (index + i) * 16;
          const x = bytes.readDoubleLE(position), y = bytes.readDoubleLE(position + 8);
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < -180.001 || x > 180.001 || y < -90 || y > 90) throw new Error('Invalid geographic geology vertex.');
          return [x, y];
        });
        const excluded = grid.withheldDegenerateRings.find(entry => entry.record === polygons.length + 1 && entry.ring === ringIndex);
        if (excluded) {
          if (ring.length !== 1 || ring[0].some((n, i) => n !== excluded.point[i])) throw new Error('Declared degenerate geology ring changed.');
          degenerate.push(excluded); return null;
        }
        if (ring.length < 4 || ring[0].some((n, i) => n !== ring.at(-1)![i])) throw new Error('Unclosed geology polygon ring.');
        return ring;
      }).filter(ring => ring !== null);
      polygons.push({rings, south: bytes.readDoubleLE(start + 12), north: bytes.readDoubleLE(start + 28)});
    }
    offset = start + size;
  }
  if (polygons.length !== grid.expectedRecords) throw new Error('Geology polygon population differs.');
  if (JSON.stringify(degenerate) !== JSON.stringify(grid.withheldDegenerateRings)) throw new Error('Declared degenerate geology rings differ.');
  return polygons;
}

function rowSpans(polygons: readonly GeologyPolygon[], latitude: number) {
  const events: [number,number|null,number][] = [];
  for (const polygon of polygons) {
    if (polygon.category === undefined) throw new Error("Geology polygon has no declared category");
    const intersections = [];
    for (const ring of polygon.rings) for (let i = 1; i < ring.length; i++) {
      const [x1, y1] = ring[i - 1], [x2, y2] = ring[i];
      if ((y1 > latitude) !== (y2 > latitude)) intersections.push(x1 + (latitude - y1) * (x2 - x1) / (y2 - y1));
    }
    intersections.sort((a, b) => a - b);
    if (intersections.length % 2) throw new Error('Odd geology scanline crossing count.');
    for (let i = 0; i < intersections.length; i += 2) {
      events.push([intersections[i], polygon.category, 1], [intersections[i + 1], polygon.category, -1]);
    }
  }
  events.sort((a, b) => a[0] - b[0]);
  const active = new Map<number|null,number>(), spans: [number,number,number][] = []; let i = 0;
  while (i < events.length) {
    const start = events[i][0];
    while (i < events.length && events[i][0] === start) {
      const [, category, delta] = events[i++], count = (active.get(category) ?? 0) + delta;
      if (count) active.set(category, count); else active.delete(category);
    }
    if (i < events.length && active.size === 1 && !active.has(null)) spans.push([start, events[i][0], active.keys().next().value!]);
  }
  return spans;
}

export function createGeologySampler(polygons: readonly (GeologyPolygon|null)[]) {
  const bins = Array.from({length: 180}, (): GeologyPolygon[] => []);
  for (const polygon of polygons.filter(polygon => polygon !== null)) {
    for (let y = Math.max(0, Math.floor(polygon.south + 90)); y <= Math.min(179, Math.floor(polygon.north + 90)); y++) bins[y].push(polygon);
  }
  let rowLatitude: number|undefined, spans: ReturnType<typeof rowSpans> = [];
  return {sample(longitude: number, latitude: number) {
    if (![longitude, latitude].every(Number.isFinite) || latitude < -90 || latitude >= 90) return null;
    const x = ((longitude + 180) % 360 + 360) % 360 - 180;
    if (rowLatitude !== latitude) {rowLatitude = latitude; spans = rowSpans(bins[Math.floor(latitude + 90)], latitude);}
    let low = 0, high = spans.length;
    while (low < high) {const middle = (low + high) >>> 1; if (spans[middle][0] <= x) low = middle + 1; else high = middle;}
    const span = spans[low - 1];
    return span && x < span[1] ? span[2] : null;
  }};
}

export async function loadGeologySurface(root: string, value: unknown) {
  const lens=validateGeologyProfile(value);
  const {grid} = lens;
  const [shape, dbf, projection] = await Promise.all([readFile(resolve(root, lens.path)), readFile(resolve(root, grid.attributePath)), readFile(resolve(root, grid.projectionPath), 'utf8')]);
  const projectionName = projection.match(/^GEOGCS\["([^"]+)"/u)?.[1];
  const sphere = projection.match(/SPHEROID\["[^"]+",([\d.]+),([\d.]+)\]/u);
  if (projectionName !== grid.coordinateSystem || Number(sphere?.[1]) !== grid.referenceRadiusMeters ||
      Number(sphere?.[2]) !== 0 || !projection.includes('PRIMEM["Reference_Meridian",0.0]') || !projection.includes('UNIT["Degree",0.0174532925199433]')) throw new Error('Geology projection differs.');
  const {rows, fields} = decodeGeologyAttributes(dbf), polygons = decodeGeologyPolygons(shape, grid);
  if (rows.length !== polygons.length || fields.find(field => field.name === grid.field)?.type !== 'C') throw new Error('Geology attribute join differs.');
  const values = new Map(lens.categories.map((category, index) => [category.value, index])), counts: Record<string,number> = {};
  rows.forEach((row, i) => {
    if (!row || !polygons[i]) {polygons[i] = null; return;}
    const value = row[grid.field];
    if (!values.has(value) && !grid.unknownValues.includes(value)) throw new Error(`Unmapped geology symbol: ${value}`);
    polygons[i]!.category = values.get(value) ?? null; counts[value] = (counts[value] ?? 0) + 1;
  });
  return {...createGeologySampler(polygons), report: {kind: 'geologic-categories', records: rows.length, field: grid.field,
    counts, withheldDegenerateRings: grid.withheldDegenerateRings, longitudeDirection: grid.longitudeDirection, missingPolicy: 'No polygon, declared unknown unit, or conflicting overlapping categories are withheld. Declared zero-area rings are excluded.',
    interpretation: 'Archived interpreted geologic units; categorical colors are presentation choices, not measured color or elevation.'}};
}

export function categoryColorForValue(value: number, lens: {categories: readonly {color:string}[]}) {
  if (!Number.isSafeInteger(value) || !lens.categories[value]) throw new Error('Invalid geology category sample.');
  const hex = lens.categories[value].color;
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
}
