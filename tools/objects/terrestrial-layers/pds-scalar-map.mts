import type {SourceMesh} from './contracts.mts';
import {parseScalarMapLens} from './source-records.mts';
import {shape,text,number} from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { loadVrmlShape } from './obj-shape.mts';

const safePath = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..');
export function validateScalarMapProfile(value: unknown, terrainValue: unknown) {
  const lens=parseScalarMapLens(value),terrain=shape({simplification:shape({method:text,maximumErrorMeters:number})})(terrainValue);
  const g = lens.grid, p = lens.surfaceSampling, r = p?.ambiguityReference;
  if (!safePath(lens.labelPath) || !lens.datasetId || !lens.productId ||
      g?.width !== 720 || g.height !== 360 || g.stepDegrees !== .5 || g.noData !== -1 ||
      ![[90, -.5], [-90, .5]].some(([first, step]) => g.latitudeFirst === first && g.latitudeStep === step) ||
      g.frame !== 'cheops-planetocentric-east-positive' || lens.sampling !== 'nearest' ||
      (lens.sourceValidRange && (lens.sourceValidRange.length !== 2 || !lens.sourceValidRange.every(Number.isFinite) || lens.sourceValidRange[0] >= lens.sourceValidRange[1])) ||
      p?.method !== 'unique-radial-map' || !(p.maximumDistanceMeters > 0) ||
      !Number.isFinite(p.maximumDistanceMeters) || terrain?.simplification?.method !== 'source-meshoptimizer' ||
      p.maximumDistanceMeters > terrain.simplification.maximumErrorMeters ||
      !safePath(r?.path) || r.format !== 'vrml-mesh' || !(r.grid?.metersPerUnit > 0) ||
      !Number.isSafeInteger(r.grid.expectedVertices) || r.grid.expectedVertices < 4 ||
      !Number.isSafeInteger(r.grid.expectedFaces) || r.grid.expectedFaces < 4) {
    throw new TypeError('Scalar maps require the pinned half-degree Cheops grid, nearest sampling, a reference mesh and bounded source-surface transfer.');
  }
}

/** PDS3 VIRTIS fixed records: coordinates are explicit, not inferred pixel centres.
 * Fail closed on reordered rows, changed sentinels, or malformed numeric fields. */
export function parseScalarMap(bytes: Buffer, label: string, value: unknown) {
  const lens=parseScalarMapLens(value);
  const key = (name: string) => new RegExp(`^\\s*${name.replace('^', '\\^')}\\s*=\\s*(?:"([^"]*)"|([^\\s]+))`, 'm').exec(label)?.slice(1).find(v => v !== undefined);
  const expected = { PDS_VERSION_ID: 'PDS3', DATA_SET_ID: lens.datasetId, PRODUCT_ID: lens.productId,
    '^TABLE': basename(lens.path).toUpperCase(), RECORD_TYPE: 'FIXED_LENGTH', RECORD_BYTES: '31',
    FILE_RECORDS: '259200', ROWS: '259200', ROW_BYTES: '31', COLUMNS: '3', MAP_RESOLUTION: '0.5' };
  for (const [name, value] of Object.entries(expected)) if (key(name) !== value) throw new Error(`Scalar map label changed: ${name}`);
  const columns = [...label.matchAll(/OBJECT\s*=\s*COLUMN\s+([\s\S]*?)END_OBJECT\s*=\s*COLUMN/g)].map(m => m[1]);
  if (columns.length !== 3 || columns.some((column, i) => !new RegExp(`START_BYTE\\s*=\\s*${i * 10 + 1}\\s`).test(column) ||
      !/BYTES\s*=\s*9\s/.test(column) || !/DATA_TYPE\s*=\s*ASCII_REAL\s/.test(column) ||
      Number(/MISSING_CONSTANT\s*=\s*([^\s]+)/.exec(column)?.[1]) !== (i === 2 ? -1 : -999)) ||
      !/NAME\s*=\s*"Latitude"/.test(columns[0]) || !/NAME\s*=\s*"Longitude"/.test(columns[1]) ||
      columns.slice(0, 2).some(c => !/UNIT\s*=\s*"DEGREE"/.test(c))) throw new Error('Scalar map column contract changed.');
  if (bytes.length !== 259200 * 31) throw new Error('Scalar map byte count changed.');
  const data = new Float64Array(259200).fill(NaN);
  const report = { rows: data.length, missingRows: 0, rejectedPhysicalRangeRows: 0, validRows: 0, validZeroRows: 0,
    minimum: Infinity, maximum: -Infinity, belowScaleRows: 0, aboveScaleRows: 0 };
  for (let i = 0; i < data.length; i++) {
    const line = bytes.toString('ascii', i * 31, (i + 1) * 31);
    if (line[9] !== ',' || line[19] !== ',' || line.slice(29) !== '\r\n') throw new Error(`Malformed scalar record ${i + 1}`);
    const fields = [line.slice(0, 9), line.slice(10, 19), line.slice(20, 29)];
    if (fields.some(f => !/^\s*[+-]?\d+\.\d{4}\s*$/.test(f))) throw new Error(`Malformed scalar number ${i + 1}`);
    const [lat, lon, raw] = fields.map(Number);
    if (lat !== lens.grid.latitudeFirst + Math.floor(i / 720) * lens.grid.latitudeStep || lon !== i % 720 * .5) throw new Error(`Scalar coordinate order changed at row ${i + 1}`);
    if (raw === -1) { report.missingRows++; continue; }
    if (lens.sourceValidRange && (raw < lens.sourceValidRange[0] || raw > lens.sourceValidRange[1])) { report.rejectedPhysicalRangeRows++; continue; }
    const value = raw * (lens.valueTransform?.scale ?? 1) + (lens.valueTransform?.offset ?? 0);
    data[i] = value; report.validRows++; if (raw === 0) report.validZeroRows++;
    report.minimum = Math.min(report.minimum, value); report.maximum = Math.max(report.maximum, value);
    if (value < lens.minimum) report.belowScaleRows++;
    if (value > lens.maximum) report.aboveScaleRows++;
  }
  if (!report.validRows) throw new Error('Scalar map has no usable measurements.');
  return { data, report };
}

/** Nearest published coordinate. No south-pole extrapolation or interpolation;
 * reject the polar half-cell because longitude is degenerate at the pole. */
export function scalarMapIndex(longitude: number, latitude: number, grid = { latitudeFirst: 90, latitudeStep: -.5 }) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) >= 89.75) return -1;
  const x = Math.round(((longitude % 360 + 360) % 360) * 2) % 720;
  const y = Math.floor((latitude - grid.latitudeFirst) / grid.latitudeStep + .5);
  return y >= 0 && y < 360 ? y * 720 + x : -1;
}

/** A latitude/longitude product cannot distinguish overlapping radial branches.
 * Check a 3x3 stencil across the half-degree footprint and every atlas sample's
 * actual direction on both meshes. This is a conservative sampled mask, not a
 * proof that the entire continuous footprint is unambiguous. */
export function createScalarMapSampler(data: ArrayLike<number>, value: unknown, mesh: SourceMesh, reference: SourceMesh, cellValidity: Uint8Array = new Uint8Array(259200)) {
  const lens=parseScalarMapLens(value);
  const unique = (lon: number, lat: number) => Boolean(mesh.hit(lon, lat, true) && reference.hit(lon, lat, true));
  const qualified = (index: number) => {
    if (index < 0 || !Number.isFinite(data[index])) return false;
    if (!cellValidity[index]) {
      const lon = index % 720 * .5, lat = lens.grid.latitudeFirst + Math.floor(index / 720) * lens.grid.latitudeStep;
      cellValidity[index] = 1;
      for (const dy of [-.25, 0, .25]) for (const dx of [-.25, 0, .25]) {
        if (!unique((lon + dx + 360) % 360, lat + dy)) cellValidity[index] = 2;
      }
    }
    return cellValidity[index] === 1;
  };
  return {
    sample(lon: number, lat: number) { const index = scalarMapIndex(lon, lat, lens.grid); return qualified(index) && unique(lon, lat) ? data[index] : null; },
    samplePoint(point: readonly number[]) {
      const hit = mesh.closestPoint(point, lens.surfaceSampling.maximumDistanceMeters);
      if (!hit || !hit.radius) return null;
      const lon = (Math.atan2(hit.point[1], hit.point[0]) * 180 / Math.PI + 360) % 360;
      const lat = Math.atan2(hit.point[2], Math.hypot(hit.point[0], hit.point[1])) * 180 / Math.PI;
      const index = scalarMapIndex(lon, lat, lens.grid);
      if (!qualified(index) || !unique(lon, lat)) return null;
      return { ...hit, value: data[index], sourceCell: index };
    },
  };
}

const referenceCache = new WeakMap<SourceMesh,Map<string,{reference:SourceMesh;cells:Uint8Array}>>();
export async function loadScalarMap(root: string, value: unknown, mesh?: SourceMesh | null) {
  const lens=parseScalarMapLens(value);
  if (!mesh?.closestPoint || !mesh?.hit) throw new Error('Scalar map transfer requires the actual full source mesh.');
  const [bytes, label] = await Promise.all([readFile(resolve(root, lens.path)), readFile(resolve(root, lens.labelPath), 'utf8')]);
  const { data, report } = parseScalarMap(bytes, label, lens);
  const recipe = lens.surfaceSampling.ambiguityReference, key = JSON.stringify({ root, recipe, grid: lens.grid });
  let cache = referenceCache.get(mesh);
  if (!cache) { cache = new Map(); referenceCache.set(mesh, cache); }
  if (!cache.has(key)) cache.set(key, { reference: await loadVrmlShape(resolve(root, recipe.path), recipe.grid), cells: new Uint8Array(259200) });
  const { reference, cells } = cache.get(key)!;
  return { ...createScalarMapSampler(data, lens, mesh, reference, cells), report: { ...report,
    sourceGrid: lens.grid, sourceUnits: lens.sourceUnits, displayUnits: lens.displayUnits, valueTransform: lens.valueTransform,
    sourceValidRange: lens.sourceValidRange ?? null, scale: [lens.minimum, lens.maximum],
    sampling: 'Nearest explicit half-degree coordinate; no interpolation; longitude wraps; polar degenerate cell withheld.',
    registration: 'Cheops angular transfer to the full RMOC mesh, bounded closest-point transfer to retained triangles. SHAP5 and RMOC 3x3 footprint rays plus each sample direction must be unique. Later archived SHAP5 is an ambiguity cross-check, not the original SHAP5 v1.1 geometry or an exact registration.' } };
}
