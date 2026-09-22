import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('hd-189733');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BODIES, hostedPlanetStateRelativeKm } from '@cssearth/astronomy';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { readAuthoredRotation } from '../../../../tools/objects/authored-rotation.mts';
import { loadStellarPhotometricColor } from '../../../../tools/objects/observation/stellar-photometric-color.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../../tools/sources/source-values.mts';

const body = resolve(import.meta.dirname, '../../../../src/objects/hd-189733'), root = resolve(body, 'source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const SOLAR_RADIUS_KM = 695700, SOLAR_GM = 132712440041.93938;

test('HD 189733 A retains its pins; its acquisitions are the font, the Gaia row and spectrum, and the three TESS light curves', async () => {
  const source = await createSourceManifest({ planetId: 'hd-189733', planetName: 'HD 189733 A', sourceRoot: root });
  await source.verify();
  const operations = requireArray(requireRecord(await read('preparation/acquisition.json')).operations).map(value => requireRecord(value));
  assert.deepEqual(operations.map(operation => requireString(operation.path)), ['presentation/InterVariable.ttf', 'photometry/gaia-dr3-source.csv', 'photometry/gaia-dr3-xp-sampled.csv',
    ...[41, 54, 81].map(sector => requireString(operations.find(operation => String(operation.path).includes(`-s00${sector}-`))?.path))]);
  const spectrum = requireRecord(requireRecord(await read('photometry/stellar-color.json')).sampledSpectrum);
  assert.equal(operations[2]!.url, spectrum.service, 'the restore fetches the spectrum the colour record cites');
});

test('radius and GM are the map paper\'s stellar values, and placement is the archived Gaia DR3 row', async () => {
  const record = requireRecord(JSON.parse(await readFile(resolve(body, '../../../packages/astronomy/data/bodies/hd-189733.json'), 'utf8')) as unknown);
  const physical = requireRecord(record.physical), star = requireRecord(record.star);
  // Lally et al. (2025), Table 1 and deposited configuration: 0.752 solar radii, 0.8070777248865484 solar masses.
  assert.equal(requireFiniteNumber(physical.meanRadiusKm), 0.752 * SOLAR_RADIUS_KM);
  assert.ok(Math.abs(requireFiniteNumber(physical.gravitationalParameterKm3PerS2) / SOLAR_GM - 0.8070777248865484) < 1e-12);
  const [header, row] = (await readFile(resolve(root, 'photometry/gaia-dr3-source.csv'), 'utf8')).trim().split('\n').map(line => line.split(','));
  const gaia = (name: string) => Number(row![header!.indexOf(name)]);
  assert.equal(gaia('source_id'), 1827242816201846144);
  assert.deepEqual([star.rightAscensionDegrees, star.declinationDegrees, star.positionEpochJulianYear, star.distanceParsecs, star.properMotionRaMasPerYear, star.properMotionDecMasPerYear, star.radialVelocityKmPerS],
    [gaia('ra'), gaia('dec'), gaia('ref_epoch'), 1000 / gaia('parallax'), gaia('pmra'), gaia('pmdec'), gaia('radial_velocity')]);
});

test('the limb darkening fitted to TESS transits of HD 189733b', async () => {
  const science = requireRecord(requireRecord(requireArray(requireRecord(await read('preparation/raster.json')).surfaces)[0]).science);
  const { limbDarkening, color } = await loadStellarPhotometricColor(path => readFile(resolve(root, path)), science, 'photometry/stellar-color.json');
  assert.deepEqual(color.srgb, [255, 226, 207]);
  assert.ok(limbDarkening && 'fit' in limbDarkening && limbDarkening.fit);
  const { coefficients, fit } = limbDarkening;
  // Recomputed with the products' 118.8-second integration: 30 transits, u1 0.2160, u2 0.4401.
  assert.equal(fit.all.transits, 30);
  assert.deepEqual(fit.sectors.map(sector => [sector.sector, sector.transits]), [[41, 10], [54, 10], [81, 10]]);
  assert.ok(Math.abs(coefficients.u1 - 0.2160) < 0.001 && Math.abs(coefficients.u2 - 0.4401) < 0.001, `u1 ${coefficients.u1}, u2 ${coefficients.u2}`);
  assert.equal(fit.all.exposureSeconds, 118.8);
  assert.ok(fit.all.shiftUncertaintySeconds > 0 && fit.all.shiftUncertaintySeconds < 2);
  assert.deepEqual(fit.all.software, { 'batman-package': '2.5.3', scipy: '1.18.1', numpy: '2.5.3' });
  assert.ok(fit.sectors.every(sector => Math.abs(sector.u1 + sector.u2 - 0.655) < 0.02), 'every sector gives nearly the same limb brightness');
  assert.ok(Math.abs(fit.all.radiusRatio - BODIES['hd-189733b'].meanRadiusKm / BODIES['hd-189733'].meanRadiusKm) < 0.001, `radius ratio ${fit.all.radiusRatio}`);
});

test('the spin axis lies 13.9 degrees from HD 189733b\'s orbit normal and turns in 11.454 days', async () => {
  const bytes = await readFile(resolve(root, 'preparation/rotation.json')), epoch = 2461286.5;
  const rotation = await readAuthoredRotation(body, { path: 'source/preparation/rotation.json', sha256: sha256(bytes) }, epoch);
  const pole = [Math.cos(rotation.poleDeclinationRad) * Math.cos(rotation.poleRightAscensionRad), Math.cos(rotation.poleDeclinationRad) * Math.sin(rotation.poleRightAscensionRad), Math.sin(rotation.poleDeclinationRad)];
  const { positionKm: r, velocityKmPerDay: v } = hostedPlanetStateRelativeKm('hd-189733b', epoch);
  const normal = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]], length = Math.hypot(...normal);
  const angle = Math.acos(pole.reduce((sum, value, axis) => sum + value * normal[axis]! / length, 0)) * 180 / Math.PI;
  assert.ok(Math.abs(angle - 13.9) < 0.05, `pole ${angle} degrees from the orbit normal`);
  assert.ok(Math.abs(rotation.spinRateRadPerDay - 2 * Math.PI / 11.454) < 1e-12);
  const record = requireRecord(JSON.parse(bytes.toString('utf8')) as unknown);
  assert.equal(record.schema, 'cssearth-measured-obliquity-pole@1');
});

test('the navigation markers of the HD 189733 system are rendered from their data', async () => {
  const { authorHd189733Markers } = await import('../../../../tools/objects/source-authoring/hd-189733/author.mts');
  await authorHd189733Markers({ check: true });
  const sharp = (await import('sharp')).default, { data, info } = await sharp(await readFile(resolve(root, 'presentation/context.png'))).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number) => data[(256 * info.width + x) * info.channels]!;
  assert.ok(at(256) > at(470), 'the star marker is darker at the limb than at the centre');
});
