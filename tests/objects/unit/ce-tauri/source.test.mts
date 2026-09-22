import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../../../tools/sources/source-values.mts';
import { loadPdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { authorCeTauri } from '../../../../tools/objects/source-authoring/ce-tauri/author.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/ce-tauri/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const PARSEC_M = 3.085677581491367e16, MAS_RAD = Math.PI / 180 / 3.6e6;

test('the reference sphere is the published diameter at the stated distance', async () => {
  const measurements = requireRecord(await read('measurements.json')), shape = requireRecord(measurements.shape);
  const raster = requireRecord(await read('preparation/raster.json'));
  for (const surface of requireArray(raster.surfaces).map(value => requireRecord(value))) {
    const terrain = requireRecord(requireRecord(surface.science).shape);
    assert.equal(requireString(terrain.path), requireString(shape.path));
    const mesh = await loadPdsRadiusTable(resolve(root, requireString(terrain.path)), terrain.grid);
    assert.ok(mesh.positions.every(position => Math.abs(Math.hypot(...position) - requireFiniteNumber(measurements.radiusKm) * 1000) < 1), `${surface.id}: every vertex at the radius`);
  }
  const star = requireRecord(requireRecord(JSON.parse(await readFile(resolve(root, '../../../../packages/astronomy/data/bodies/ce-tauri.json'), 'utf8')) as unknown).star);
  const radiusM = requireFiniteNumber(measurements.radiusKm) * 1000;
  const implied = requireFiniteNumber(measurements.angularDiameterMas) * MAS_RAD / 2 * requireFiniteNumber(star.distanceParsecs) * PARSEC_M;
  assert.ok(Math.abs(implied - radiusM) / radiusM < 1e-6, `the radius is the published diameter at the stated distance: ${implied} against ${radiusM}`);
});

test('the sphere table and the navigation marker are the authoring tool\'s output', async () => {
  const result = await authorCeTauri({ check: true });
  assert.equal(result.width, 32); assert.equal(result.height, 32);
});
