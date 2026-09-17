import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../../../tools/source-values.mts';
import { neutralDiscMarker } from '../../../../tools/objects/new-star.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/wasp-43/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const SOLAR_RADIUS_KM = 695700, SOLAR_GM = 132712440041.93938, PARSEC_M = 3.085677581491367e16, MAS_RAD = Math.PI / 180 / 3.6e6;

test('WASP-43 retains source pins and has no observation to acquire', async () => {
  const source = await createSourceManifest({ planetId: 'wasp-43', planetName: 'WASP-43', sourceRoot: root });
  await source.verify();
  const plan = requireRecord(await read('preparation/acquisition.json'));
  assert.ok(requireArray(plan.operations).every(operation => requireString(requireRecord(operation).path).startsWith('presentation/')), 'only the title font is downloaded');
});

test('the lens is the Gaia photometric colour, radius and GM are the stellar values the planet map assumes, and the distance is the Gaia parallax', async () => {
  const surfaces = requireArray(requireRecord(await read('preparation/raster.json')).surfaces).map(value => requireRecord(value));
  assert.equal(requireRecord(surfaces[0]!.science).kind, 'stellar-photometric-color');
  const record = requireRecord(JSON.parse(await readFile(resolve(root, '../../../../packages/astronomy/data/bodies/wasp-43.json'), 'utf8')) as unknown);
  const physical = requireRecord(record.physical), star = requireRecord(record.star), measurements = requireRecord(await read('measurements.json'));
  // Challener et al. (2024), Table 1: 0.665 solar radii, 0.6916 solar masses.
  assert.equal(requireFiniteNumber(physical.meanRadiusKm), 0.665 * SOLAR_RADIUS_KM);
  assert.ok(Math.abs(requireFiniteNumber(physical.gravitationalParameterKm3PerS2) / SOLAR_GM - 0.6916) < 1e-9);
  assert.equal(requireFiniteNumber(star.distanceParsecs), 1000 / 11.474);
  const computed = 2 * requireFiniteNumber(physical.meanRadiusKm) * 1000 / (requireFiniteNumber(star.distanceParsecs) * PARSEC_M) / MAS_RAD;
  assert.ok(Math.abs(requireFiniteNumber(measurements.angularDiameterMas) - computed) < 1e-4, 'the angular diameter is computed, and says so');
  assert.match(requireString(measurements.angularDiameterSource), /^Not measured/u);
});

test("the navigation marker is the scaffold's disc in the photosphere colour", async () => {
  assert.ok((await readFile(resolve(root, 'presentation/context.png'))).equals(await neutralDiscMarker(512, 0.9, [255, 220, 184])));
});
