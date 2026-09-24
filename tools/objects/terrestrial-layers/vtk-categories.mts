import type {SourceMesh,ClosestSurfacePoint} from './contracts.mts';
import {parseVtkLens,parseVtkGrid} from './source-records.mts';
import {shape,text,number} from '@cssearth/core';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createIndexedShape} from './obj-shape.mts';
import {loadSbmtSymbols} from './sbmt-symbols.mts';

const local = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.split('/').includes('..');

/** A separate source surface carries categorical cell values. Display geometry
 * is still the body's existing mesh; neither a radial map nor interpolation of
 * integer IDs can preserve categories through an irregular body's concavities. */
export function validateVtkCategories(value: unknown, terrainValue: unknown) {
  const lens=parseVtkLens(value),terrain=shape({path:text,simplification:shape({maximumErrorMeters:number})})(terrainValue);
  const g = lens.grid, s = lens.surfaceSampling;
  if (lens.format !== 'vtk-cell-categories' || !local(lens.path) || !g ||
      ![g.expectedVertices, g.expectedFaces].every(n => Number.isSafeInteger(n) && n > 0) ||
      !(g.metersPerUnit > 0) || typeof g.field !== 'string' || !g.field ||
      !Array.isArray(lens.categories) || lens.categories.length < 2 ||
      !Array.isArray(lens.cellCategories) || !lens.cellCategories.length ||
      lens.cellCategories.some(n => n !== null && (!Number.isSafeInteger(n) || !lens.categories[n])) ||
      lens.categories.some(c => !c.value || !c.label || !/^#[0-9a-f]{6}$/i.test(c.color)) ||
      new Set(lens.categories.map(c => c.value)).size !== lens.categories.length ||
      lens.sampling !== 'nearest' || lens.displaySampling !== 'nearest' || lens.relief || lens.valueTransform ||
      s?.method !== 'closest-registered-surface' || !local(s.renderedMeshPath) || s.renderedMeshPath !== terrain?.path ||
      !(s.maximumDistanceMeters > 0) || s.maximumDistanceMeters > terrain.simplification.maximumErrorMeters ||
      !Number.isFinite(s.maximumRegistrationDistanceMeters) || !(s.maximumRegistrationDistanceMeters > 0)) throw new TypeError('Invalid VTK categorical surface profile.');
  const symbols = lens.symbols;
  if (symbols && (![symbols.paths, symbols.locations].every(local) ||
      typeof symbols.shapeModel !== 'string' || !symbols.shapeModel ||
      ![symbols.expectedPaths, symbols.expectedLocations].every(n => Number.isSafeInteger(n) && n > 0) ||
      ![symbols.lineWidthMeters, symbols.locationDiameterMeters, symbols.maximumSegmentMeters,
        symbols.maximumRegistrationDistanceMeters].every(n => Number.isFinite(n) && n > 0) ||
      !symbols.colorCategories || !Object.values(symbols.colorCategories).length ||
      Object.values(symbols.colorCategories).some(n => !Number.isSafeInteger(n) || !lens.categories[n]))) throw new TypeError('Invalid SBMT cartographic symbol profile.');
}

export function decodeVtkCategories(text: string, value: unknown) {
  const grid=parseVtkGrid(value);
  const tokens = text.trim().split(/\s+/); let at = tokens.indexOf('POINTS');
  if (!text.startsWith('# vtk DataFile Version 2.0\n') || !text.includes('\nASCII\nDATASET POLYDATA\n') || at < 0) throw new Error('Unsupported categorical VTK header.');
  const take = (expected: string) => {if (tokens[at++] !== expected) throw new Error('Unexpected categorical VTK field: ' + expected);};
  const integer = () => {const n = Number(tokens[at++]); if (!Number.isSafeInteger(n)) throw new Error('Non-integer VTK index.'); return n;};
  take('POINTS'); const vertexCount = integer(); take('float');
  if (vertexCount !== grid.expectedVertices) throw new Error('VTK vertex count changed.');
  const positions = Array.from({length: vertexCount}, () => Array.from({length: 3}, () => {
    const n = Number(tokens[at++]) * grid.metersPerUnit;
    if (!Number.isFinite(n)) throw new Error('Non-finite VTK coordinate.'); return n;
  }));
  take('POLYGONS'); const faceCount = integer(), entries = integer();
  if (faceCount !== grid.expectedFaces || entries !== faceCount * 4) throw new Error('VTK polygon count changed.');
  const indices = Array.from({length: faceCount}, () => {
    if (integer() !== 3) throw new Error('Categorical VTK requires triangles.');
    return [integer(), integer(), integer()];
  });
  take('CELL_DATA'); if (integer() !== faceCount) throw new Error('VTK cell count changed.');
  take('SCALARS'); take(grid.field); take('integer'); take('1'); take('LOOKUP_TABLE'); take('default');
  const values = Int32Array.from({length: faceCount}, integer);
  if (at !== tokens.length) throw new Error('Unconsumed categorical VTK data.');
  return {positions, indices, values};
}

export async function loadVtkCategories(root: string, value: unknown, renderedMesh: SourceMesh) {
  const lens=parseVtkLens(value);
  const decoded = decodeVtkCategories(await readFile(resolve(root, lens.path), 'utf8'), lens.grid);
  const mesh = createIndexedShape(decoded.positions, decoded.indices, lens.grid);
  const counts: Record<number,number> = {};
  for (const id of decoded.values) {
    if (id < 0 || id >= lens.cellCategories.length) throw new Error('Unmapped VTK region ID: ' + id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const symbols = lens.symbols && await loadSbmtSymbols(root, lens.symbols, mesh);
  function classify(hit: ClosestSurfacePoint) {
    const region = decoded.values[hit.faceId], base = lens.cellCategories[region];
    if (base === null) return null;
    const symbol = symbols?.sample(hit.point);
    return {...hit, value: symbol?.category ?? base, sourceCell: symbols ? (symbol?.id ?? 0) : hit.faceId,
      region, registrationDistanceMeters: hit.distanceMeters};
  }
  function samplePoint(point: readonly number[]) {
    const source = renderedMesh.closestPoint(point, lens.surfaceSampling.maximumDistanceMeters);
    if (!source) return null;
    const hit = mesh.closestPoint(source.point, lens.surfaceSampling.maximumRegistrationDistanceMeters);
    if (!hit) return null;
    const sample = classify(hit);
    return sample && {...sample, normal: source.normal, radius: source.radius, distanceMeters: source.distanceMeters};
  }
  return {samplePoint,
    sample(longitude: number, latitude: number) {
      const hit = renderedMesh.hit(longitude, latitude, true);
      if (!hit) return null;
      const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180;
      return samplePoint([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)].map(n => n * hit.radius))?.value ?? null;
    },
    report: {sourceFormat: lens.format, sourceMesh: lens.path, renderedMesh: lens.surfaceSampling.renderedMeshPath,
      field: lens.grid.field, counts, cellCategories: lens.cellCategories,
      registration: 'Closest rendered-source surface point, then closest released categorical triangle, each independently bounded in metres; original Cartesian frame and categorical cell IDs retained.',
      maximumRegistrationDistanceMeters: lens.surfaceSampling.maximumRegistrationDistanceMeters,
      ...(symbols ? {symbols: symbols.report} : {})},
  };
}
