import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('antares');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../../../tools/sources/source-values.mts';
import { authorAntares } from '../../../../tools/objects/source-authoring/antares/author.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/antares/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const PARSEC_M = 3.085677581491367e16, MAS_RAD = Math.PI / 180 / 3.6e6;

test('the lens is the shared neutral gray and the radius is the published diameter at the stated distance', async () => {
  const raster = requireRecord(await read('preparation/raster.json')), surfaces = requireArray(raster.surfaces).map(value => requireRecord(value));
  assert.equal(surfaces.length, 1);
  assert.equal(requireRecord(surfaces[0]!.science).kind, 'neutral-shape');
  const measurements = requireRecord(await read('measurements.json'));
  const star = requireRecord(requireRecord(JSON.parse(await readFile(resolve(root, '../../../../packages/astronomy/data/bodies/antares.json'), 'utf8')) as unknown).star);
  const radiusM = requireFiniteNumber(measurements.radiusKm) * 1000;
  const implied = requireFiniteNumber(measurements.angularDiameterMas) * MAS_RAD / 2 * requireFiniteNumber(star.distanceParsecs) * PARSEC_M;
  assert.ok(Math.abs(implied - radiusM) / radiusM < 1e-6, `the radius is the published diameter at the stated distance: ${implied} against ${radiusM}`);
  assert.equal(requireFiniteNumber(measurements.distanceParsecs), requireFiniteNumber(star.distanceParsecs));
  const rotation = requireRecord(await read('preparation/rotation.json'));
  assert.equal(rotation.schema, 'cssearth-display-orientation@1');
  assert.match(requireString(rotation.qualification), /not a measurement/u);
});

test('the navigation marker is the authoring tool\'s output', async () => {
  assert.equal((await authorAntares({ check: true })).size, 512);
});
