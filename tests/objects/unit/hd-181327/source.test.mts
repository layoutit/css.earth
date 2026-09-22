import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { loadStellarPhotometricColor } from '../../../../tools/objects/observation/stellar-photometric-color.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../../tools/sources/source-values.mts';

const body = resolve(import.meta.dirname, '../../../../src/objects/hd-181327'), root = resolve(body, 'source');
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
const csv = async (path: string) => {
  const [header, row] = (await readFile(resolve(root, path), 'utf8')).trim().split('\n').map(line => line.split(','));
  return (name: string) => Number(row![header!.indexOf(name)]);
};
const SOLAR_RADIUS_KM = 695700, SOLAR_GM = 132712440041.93938;

test('HD 181327 retains its pins; its acquisitions are the font, the two Gaia rows and the spectrum', async () => {
  const source = await createSourceManifest({ planetId: 'hd-181327', planetName: 'HD 181327', sourceRoot: root });
  await source.verify();
  const operations = requireArray(requireRecord(await read('preparation/acquisition.json')).operations).map(value => requireRecord(value));
  assert.deepEqual(operations.map(operation => requireString(operation.path)),
    ['presentation/InterVariable.ttf', 'photometry/gaia-dr3-source.csv', 'photometry/gaia-dr3-astrophysical-parameters.csv', 'photometry/gaia-dr3-xp-sampled.csv', 'photometry/claret-2017-tess-quadratic.tsv']);
  const spectrum = requireRecord(requireRecord(await read('photometry/stellar-color.json')).sampledSpectrum);
  assert.equal(operations[3]!.url, spectrum.service, 'the restore fetches the spectrum the colour record cites');
});

test('radius and GM are the Gaia DR3 FLAME values, and placement is the archived Gaia DR3 row', async () => {
  const record = requireRecord(JSON.parse(await readFile(resolve(body, '../../../packages/astronomy/data/bodies/hd-181327.json'), 'utf8')) as unknown);
  const physical = requireRecord(record.physical), star = requireRecord(record.star);
  const flame = await csv('photometry/gaia-dr3-astrophysical-parameters.csv');
  assert.equal(flame('source_id'), 6643589352010758400);
  assert.ok(Math.abs(requireFiniteNumber(physical.meanRadiusKm) - flame('radius_flame') * SOLAR_RADIUS_KM) < 0.1);
  assert.ok(Math.abs(requireFiniteNumber(physical.gravitationalParameterKm3PerS2) / SOLAR_GM - flame('mass_flame')) < 1e-9);
  const gaia = await csv('photometry/gaia-dr3-source.csv');
  assert.equal(gaia('source_id'), 6643589352010758400);
  assert.deepEqual([star.rightAscensionDegrees, star.declinationDegrees, star.positionEpochJulianYear, star.distanceParsecs, star.properMotionRaMasPerYear, star.properMotionDecMasPerYear, star.radialVelocityKmPerS],
    [gaia('ra'), gaia('dec'), gaia('ref_epoch'), 1000 / gaia('parallax'), gaia('pmra'), gaia('pmdec'), gaia('radial_velocity')]);
});

test('the colour is that of the Gaia spectrum, darkened toward the limb by the Claret (2017) model grid at the Gaia temperature and gravity', async () => {
  const science = requireRecord(requireRecord(requireArray(requireRecord(await read('preparation/raster.json')).surfaces)[0]).science);
  const { limbDarkening, color, spectrum } = await loadStellarPhotometricColor(path => readFile(resolve(root, path)), science, 'photometry/stellar-color.json');
  assert.deepEqual(color.srgb, [238, 237, 255]);
  assert.equal(spectrum?.samples, 343);
  assert.ok(limbDarkening && limbDarkening.recipe.source === 'grid');
  // The grid route interpolates at the archived Gaia row's GSP-Phot temperature and the FLAME gravity, not at typed numbers.
  const parameters = await csv('photometry/gaia-dr3-astrophysical-parameters.csv');
  assert.ok(Math.abs(limbDarkening.recipe.teffK - parameters('teff_gspphot')) < 0.001);
  assert.ok(Math.abs(limbDarkening.recipe.logg - (4.438 + Math.log10(parameters('mass_flame')) - 2 * Math.log10(parameters('radius_flame')))) < 1e-4);
  // Bilinear between 6300 and 6400 K and log g 4.0 and 4.5 of the quasi-spherical PHOENIX-COND least-squares coefficients.
  assert.ok(Math.abs(limbDarkening.coefficients.u1 - 0.3236) < 0.0005 && Math.abs(limbDarkening.coefficients.u2 - 0.2234) < 0.0005, `${limbDarkening.coefficients.u1}, ${limbDarkening.coefficients.u2}`);
});
