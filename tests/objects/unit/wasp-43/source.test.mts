import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('wasp-43');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../../../tools/sources/source-values.mts';

const root = resolve(import.meta.dirname, '../../../../src/objects/wasp-43/source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const SOLAR_RADIUS_KM = 695700, SOLAR_GM = 132712440041.93938, PARSEC_M = 3.085677581491367e16, MAS_RAD = Math.PI / 180 / 3.6e6;

test('WASP-43 retains source pins; its acquisitions are the title font, the Gaia query its colour cites and the limb-darkening row', async () => {
  const source = await createSourceManifest({ planetId: 'wasp-43', planetName: 'WASP-43', sourceRoot: root });
  await source.verify();
  const operations = requireArray(requireRecord(await read('preparation/acquisition.json')).operations).map(value => requireRecord(value));
  assert.deepEqual(operations.map(operation => requireString(operation.path)), ['presentation/InterVariable.ttf', 'photometry/gaia-dr3-source.csv', 'photometry/patel-2022-limb-darkening.tsv']);
  const temperature = requireRecord(requireRecord(await read('photometry/stellar-color.json')).temperature), gaia = operations[1]!;
  assert.equal(gaia.url, temperature.service);
  assert.equal(requireRecord(gaia.form).QUERY, temperature.query, 'the restore runs the query the colour record cites');
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

test('the navigation markers of WASP-43 and WASP-43b are rendered from their data, not flat discs', async () => {
  const { planetMarker, starMarker } = await import('../../../../tools/objects/source-authoring/wasp-43/author.mts');
  assert.ok((await readFile(resolve(root, 'presentation/context.png'))).equals(await starMarker()), 'WASP-43: the limb-darkened colour disc');
  assert.ok((await readFile(resolve(root, '../../wasp-43b/source/presentation/context.png'))).equals(await planetMarker()), 'WASP-43b: the NIRSpec dayside');
  const sharp = (await import('sharp')).default, { data, info } = await sharp(await readFile(resolve(root, 'presentation/context.png'))).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number) => data[(256 * info.width + x) * info.channels]!;
  assert.ok(at(256) > at(470), 'the star marker is darker at the limb than at the centre');
});
