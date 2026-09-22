import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString } from '../../../../tools/sources/source-values.mts';
import { loadPdsRadiusTable } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { uniformDiscTable } from '../../../../tools/objects/source-authoring/betelgeuse/author.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;

test('the reference sphere is the published radius on the stated grid', async () => {
  const measurements = requireRecord(await read('measurements.json')), shape = requireRecord(measurements.shape);
  const text = await readFile(resolve(root, requireString(shape.path)), 'utf8');
  assert.equal(text, uniformDiscTable(Number(measurements.radiusKm), Number(shape.stepDegrees)), 'the table is the authoring tool\'s output');
  const raster = requireRecord(await read('preparation/raster.json')), terrain = requireRecord(requireRecord(requireRecord(requireArray(raster.surfaces)[0]).science).shape);
  const mesh = await loadPdsRadiusTable(resolve(root, requireString(terrain.path)), terrain.grid);
  assert.equal(mesh.positions.length, 2522); assert.equal(mesh.indices.length, 5040);
  const radii = mesh.positions.map(position => Math.hypot(...position));
  assert.ok(radii.every(radius => Math.abs(radius - 531514800000) < 1), 'every vertex sits at the published radius in metres');
  // 764 solar radii, and the pinned 42.45 mas disc at 168 pc within half a percent of it.
  assert.ok(Math.abs(531514800 / 695700 - 764) < 0.01);
  const discRadiusKm = 42.45 / 2 * Math.PI / 180 / 3.6e6 * 168 * 3.085677581491367e13;
  assert.ok(Math.abs(discRadiusKm / 531514800 - 1) < 0.005, `disc radius ${discRadiusKm} km against the published ${531514800} km`);
});
