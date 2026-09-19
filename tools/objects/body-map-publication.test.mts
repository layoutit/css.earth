import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { sha256 } from '../../src/platform/sha256.mts';
import { formatBodyMapProduct, type BodyMapProduct } from './body-map-product.mts';
import { bodyMapProductRecord, formatProductRecord, qualifyBodyMap } from './body-map-publication.mts';
import type { ObservationSelection } from './telescopes/query.mts';

const plane = Buffer.from('a small deterministic FITS stand-in');
const product = (): BodyMapProduct => ({ schema: 'cssearth-body-map@1',
  definition: { quantity: 'CO2 band depth', units: 'band depth', timeDependence: 'surface-property', source: 'a published definition',
    method: { bandMicrometres: [4.24, 4.28], continuumMicrometres: [[4.2, 4.225], [4.3, 4.33]] } },
  frame: { body: 'europa', radiusKm: 1560.8, rotation: { model: 'pck00011.tpc', sha256: 'a'.repeat(64), bodyCode: 502 } },
  grid: { width: 4, height: 2, longitude: 'east-positive-from-0', rows: 'north-to-south' },
  planes: { file: 'co2.fits', sha256: sha256(plane), value: 'CO2 BAND DEPTH', uncertainty: 'CO2 BAND DEPTH ERROR' },
  mask: { maximumEmissionDegrees: 65, missing: 'NaN' }, observations: [{ id: 'jw01250-o002', telescope: 'JWST', instrument: 'NIRSPEC-G395H-F290LP',
    mode: 'NIRSPEC/IFU', programme: 'europa-1250', midTimeJd: 2_459_800.5, rangeKm: 6.3e8,
    subObserver: { latitudeDegrees: 0, westLongitudeDegrees: 180 }, angularResolution: { majorArcsec: 0.1, minorArcsec: 0.1, basis: 'disc-edge fit' } }] });
const selection: ObservationSelection = { schema: 'cssearth-telescope-observation-selection@1', request: { target: 'europa', wavelengthMicrometres: [4.24, 4.28], kind: 'cube', result: 'body-map', time: { any: true }, angularResolutionArcsec: 0.3 },
  telescope: 'JWST', mode: 'NIRSPEC/IFU', programme: 'europa-1250', toolkitLevel: 'proven', constraints: {},
  bodyMapSupport: { answer: 'yes', author: 'tools/objects/jwst/cubes/author-body-maps.mts', reason: 'the body-map author' }, unresolved: [],
  evidence: { ledger: 'data/jwst/ledger.json', archiveDate: '2026-09-19', receipts: [], bodyMaps: [], investigations: [] } };

async function fixture(value = product()) {
  const directory = await mkdtemp(resolve(tmpdir(), 'body-map-publication-')), planePath = resolve(directory, value.planes.file), mapPath = `${planePath}.body-map.json`;
  const metadata = Buffer.from(formatBodyMapProduct(value)), record = bodyMapProductRecord(value, plane, metadata,
    [{ role: 'spectral cube', identity: 'mast:JWST/product/jw01250-o002_s3d.fits', bytes: 12, sha256: 'b'.repeat(64) }],
    [{ name: 'cssEarth author-body-maps', version: '1' }]);
  await writeFile(planePath, plane); await writeFile(mapPath, metadata); await writeFile(`${planePath}.product.json`, formatProductRecord(record));
  return { directory, planePath, mapPath };
}

test('publication binds the question and selected program to current map bytes', async () => {
  const { mapPath } = await fixture(), layer = await qualifyBodyMap(mapPath, selection);
  assert.equal(layer.target, 'europa'); assert.equal(layer.selection.programme, 'europa-1250');
  assert.deepEqual({ metadata: layer.map.metadata, productRecord: layer.map.productRecord, plane: layer.map.plane },
    { metadata: 'co2.fits.body-map.json', productRecord: 'co2.fits.product.json', plane: 'co2.fits' });
  assert.equal(layer.map.quantity, 'CO2 band depth'); assert.equal(layer.observations[0]!.mode, 'NIRSPEC/IFU');
});

test('publication refuses changed bytes, changed meaning and a selection absent from the map', async () => {
  const changedPlane = await fixture(); await writeFile(changedPlane.planePath, 'changed');
  await assert.rejects(qualifyBodyMap(changedPlane.mapPath, selection), /not the plane pinned/u);

  const changedMeaning = await fixture(), parsed = JSON.parse(await readFile(changedMeaning.mapPath, 'utf8')) as Record<string, unknown>;
  parsed.definition = { ...(parsed.definition as object), quantity: 'another quantity' };
  await writeFile(changedMeaning.mapPath, `${JSON.stringify(parsed, null, 2)}\n`);
  await assert.rejects(qualifyBodyMap(changedMeaning.mapPath, selection), /does not describe the output bytes|does not pin its/u);

  const other = { ...selection, programme: 'europa-4023-o001' };
  await assert.rejects(qualifyBodyMap((await fixture()).mapPath, other), /names no JWST NIRSPEC\/IFU observation/u);
});

test('publication refuses a map observation that omits its exact mode or program', async () => {
  const incomplete = product();
  const observation = { ...incomplete.observations[0] };
  delete (observation as { mode?: string }).mode;
  const { mapPath } = await fixture({ ...incomplete, observations: [observation] });
  await assert.rejects(qualifyBodyMap(mapPath, selection), /without an exact ledger mode and program|names no JWST/u);
});

test('publication explains the missing body-map contract instead of leaking a file error', async () => {
  await assert.rejects(qualifyBodyMap(resolve(tmpdir(), 'missing-ceres.fits.body-map.json'), { ...selection, telescope: 'VLT/NACO', mode: 'imaging', programme: 'ceres-080C0881' }),
    /Cannot publish VLT\/NACO imaging program ceres-080C0881: the body-map metadata is missing.*map plane.*body-map\.json.*product\.json/u);
});
