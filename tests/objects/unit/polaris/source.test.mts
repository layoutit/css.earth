import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../../../tools/sources/source-values.mts';
import { neutralDiscMarker } from '../../../../tools/objects/new-star.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/polaris/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const PARSEC_M = 3.085677581491367e16, MAS_RAD = Math.PI / 180 / 3.6e6, SOLAR_GM = 132712440041.93938;
const astronomy = async () => requireRecord(JSON.parse(await readFile(resolve(root, '../../../../packages/astronomy/data/bodies/polaris.json'), 'utf8')) as unknown);

test('the lens is the shared neutral gray, and radius and GM are the published diameter and mass at the adopted distance', async () => {
  const raster = requireRecord(await read('preparation/raster.json')), surfaces = requireArray(raster.surfaces).map(value => requireRecord(value));
  assert.equal(surfaces.length, 1);
  assert.equal(requireRecord(surfaces[0]!.science).kind, 'neutral-shape');
  const measurements = requireRecord(await read('measurements.json')), record = await astronomy(), star = requireRecord(record.star);
  // Evans et al. (2024): 3.143 mas, 136.90 pc, 5.13 solar masses.
  assert.equal(requireFiniteNumber(measurements.angularDiameterMas), 3.143);
  assert.equal(requireFiniteNumber(star.distanceParsecs), 136.9);
  assert.equal(requireFiniteNumber(measurements.distanceParsecs), requireFiniteNumber(star.distanceParsecs));
  const radiusM = requireFiniteNumber(measurements.radiusKm) * 1000;
  const implied = 3.143 * MAS_RAD / 2 * 136.9 * PARSEC_M;
  assert.ok(Math.abs(implied - radiusM) / radiusM < 1e-6, `the radius is the published diameter at the stated distance: ${implied} against ${radiusM}`);
  const physical = requireRecord(record.physical);
  assert.equal(requireFiniteNumber(physical.meanRadiusKm) * 1000, radiusM);
  assert.ok(Math.abs(requireFiniteNumber(physical.gravitationalParameterKm3PerS2) / SOLAR_GM - 5.13) < 1e-9, 'GM is 5.13 solar masses');
  const rotation = requireRecord(await read('preparation/rotation.json'));
  assert.equal(rotation.schema, 'cssearth-display-orientation@1');
  assert.match(requireString(rotation.qualification), /not a measurement/u);
});

test('the navigation marker is the scaffold\'s neutral disc', async () => {
  assert.ok((await readFile(resolve(root, 'presentation/context.png'))).equals(await neutralDiscMarker(512)));
});
