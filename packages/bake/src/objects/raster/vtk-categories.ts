import type { SourceMesh, ClosestSurfacePoint } from '../geometry/index.ts';
import {parseVtkDataset,parseVtkGrid} from './source-records.ts';
import {shape,text,number} from '@cssearth/core';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createIndexedShape, decodeVtkMesh} from '../geometry/index.ts';
import {loadSbmtSymbols} from './sbmt-symbols.ts';

const local = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.split('/').includes('..');

/** A separate source surface carries categorical cell values. Display geometry
 * is still the body's existing mesh; neither a radial map nor interpolation of
 * integer IDs can preserve categories through an irregular body's concavities. */
export function validateVtkCategories(value: unknown, terrainValue: unknown) {
  const dataset=parseVtkDataset(value),terrain=shape({path:text,simplification:shape({maximumErrorMeters:number})})(terrainValue);
  const g = dataset.grid, s = dataset.surfaceSampling;
  if (dataset.format !== 'vtk-cell-categories' || !local(dataset.path) || !g ||
      ![g.expectedVertices, g.expectedFaces].every(n => Number.isSafeInteger(n) && n > 0) ||
      !(g.metersPerUnit > 0) || typeof g.field !== 'string' || !g.field ||
      !Array.isArray(dataset.categories) || dataset.categories.length < 2 ||
      !Array.isArray(dataset.cellCategories) || !dataset.cellCategories.length ||
      dataset.cellCategories.some(n => n !== null && (!Number.isSafeInteger(n) || !dataset.categories[n])) ||
      dataset.categories.some(c => !c.value || !c.label || !/^#[0-9a-f]{6}$/i.test(c.color)) ||
      new Set(dataset.categories.map(c => c.value)).size !== dataset.categories.length ||
      dataset.sampling !== 'nearest' || dataset.displaySampling !== 'nearest' || dataset.relief || dataset.valueTransform ||
      s?.method !== 'closest-registered-surface' || !local(s.renderedMeshPath) || s.renderedMeshPath !== terrain?.path ||
      !(s.maximumDistanceMeters > 0) || s.maximumDistanceMeters > terrain.simplification.maximumErrorMeters ||
      !Number.isFinite(s.maximumRegistrationDistanceMeters) || !(s.maximumRegistrationDistanceMeters > 0)) throw new TypeError('Invalid VTK categorical surface profile.');
  const symbols = dataset.symbols;
  if (symbols && (![symbols.paths, symbols.locations].every(local) ||
      typeof symbols.shapeModel !== 'string' || !symbols.shapeModel ||
      ![symbols.expectedPaths, symbols.expectedLocations].every(n => Number.isSafeInteger(n) && n > 0) ||
      ![symbols.lineWidthMeters, symbols.locationDiameterMeters, symbols.maximumSegmentMeters,
        symbols.maximumRegistrationDistanceMeters].every(n => Number.isFinite(n) && n > 0) ||
      !symbols.colorCategories || !Object.values(symbols.colorCategories).length ||
      Object.values(symbols.colorCategories).some(n => !Number.isSafeInteger(n) || !dataset.categories[n]))) throw new TypeError('Invalid SBMT cartographic symbol profile.');
}

export function decodeVtkCategories(text: string, value: unknown) {
  const grid=parseVtkGrid(value);
  const { positions, indices, cellField } = decodeVtkMesh(text, grid);
  if (!cellField || cellField.name !== grid.field) throw new Error('Unexpected categorical VTK field.');
  return { positions, indices, values: cellField.values };
}

export async function loadVtkCategories(root: string, value: unknown, renderedMesh: SourceMesh) {
  const dataset=parseVtkDataset(value);
  const decoded = decodeVtkCategories(await readFile(resolve(root, dataset.path), 'utf8'), dataset.grid);
  const mesh = createIndexedShape(decoded.positions, decoded.indices, dataset.grid);
  const counts: Record<number,number> = {};
  for (const id of decoded.values) {
    if (id < 0 || id >= dataset.cellCategories.length) throw new Error('Unmapped VTK region ID: ' + id);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const symbols = dataset.symbols && await loadSbmtSymbols(root, dataset.symbols, mesh);
  function classify(hit: ClosestSurfacePoint) {
    const region = decoded.values[hit.faceId], base = dataset.cellCategories[region];
    if (base === null) return null;
    const symbol = symbols?.sample(hit.point);
    return {...hit, value: symbol?.category ?? base, sourceCell: symbols ? (symbol?.id ?? 0) : hit.faceId,
      region, registrationDistanceMeters: hit.distanceMeters};
  }
  function samplePoint(point: readonly number[]) {
    const source = renderedMesh.closestPoint(point, dataset.surfaceSampling.maximumDistanceMeters);
    if (!source) return null;
    const hit = mesh.closestPoint(source.point, dataset.surfaceSampling.maximumRegistrationDistanceMeters);
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
    report: {sourceFormat: dataset.format, sourceMesh: dataset.path, renderedMesh: dataset.surfaceSampling.renderedMeshPath,
      field: dataset.grid.field, counts, cellCategories: dataset.cellCategories,
      registration: 'Closest rendered-source surface point, then closest released categorical triangle, each independently bounded in metres; original Cartesian frame and categorical cell IDs retained.',
      maximumRegistrationDistanceMeters: dataset.surfaceSampling.maximumRegistrationDistanceMeters,
      ...(symbols ? {symbols: symbols.report} : {})},
  };
}
