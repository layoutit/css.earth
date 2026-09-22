import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseSkyTarget, readSkyTarget, simbadObjectQuery, skyCatalogueEntry, skyRegion, skyTargetId, type SkyTarget } from './sky-target.mts';
import { skyTargetRequest } from './exploration.mts';
import type { MetadataResponse } from './vo/contracts.mts';

const field = (name: string, unit: string | null) => ({ name, id: null, datatype: 'char', arraysize: null, unit, ucd: null, utype: null, xtype: null, ref: null });
const response = (rows: MetadataResponse['rows'], units: Readonly<Record<string, string | null>> = { ra: 'deg', dec: 'deg', coo_err_maj: 'mas' }): MetadataResponse => ({
  schema: 'cssearth-vo-metadata@1', pyvo: '1.9.1', raw: { path: 'simbad.xml', bytes: 1, sha256: '0'.repeat(64) }, effectiveUrl: 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync',
  fetchedAt: '2026-09-22T00:00:00Z', httpStatus: 200, queryStatus: 'OK',
  fields: [...Object.entries(units).map(([name, unit]) => field(name, unit)), field('main_id', null), field('oid', null), field('coo_bibcode', null), field('otype', null), field('id', null)],
  rows, resources: [], coordinateSystems: [], timeSystems: [], issues: [], times: rows.map(() => ({})), bindings: [] });
// The values SIMBAD returned for Sgr A* on 2026-09-22.
const sgrA = { oid: 3257207, main_id: 'NAME Sgr A*', ra: 266.41681662499997, dec: -29.00782497222222, coo_err_maj: 2.65, coo_bibcode: '2011AJ....142...35P', otype: 'X' };
const identifiers = response([{ id: 'NAME Sgr A*' }, { id: 'NAME Sagittarius A*' }, { id: 'CXOGC J174540.0-290027' }]);

test('SIMBAD names and places a target the catalogue does not ship', () => {
  const target = readSkyTarget(response([sgrA]), identifiers, [])!;
  assert.equal(target.id, 'simbad-name-sgr-a'); assert.equal(target.id, skyTargetId('NAME Sgr A*'));
  assert.deepEqual(target.identifiers, ['NAME Sgr A*', 'NAME Sagittarius A*', 'CXOGC J174540.0-290027']);
  assert.equal(target.positionErrorMas, 2.65); assert.equal(target.positionBibcode, '2011AJ....142...35P');
  const region = skyRegion(target)!;
  assert.equal(region.radiusDegrees * 3_600_000, 2.65, 'the circle is SIMBAD\'s position error, not a radius chosen here');
  assert.deepEqual(skyCatalogueEntry(target, 'Sgr A*'), { id: 'simbad-name-sgr-a', name: 'Sgr A*', aliases: ['NAME Sgr A*', 'NAME Sagittarius A*', 'CXOGC J174540.0-290027', 'Sgr A*'] });
});

test('SIMBAD answers are refused when a unit, a count or a position is not what the target needs', () => {
  assert.equal(readSkyTarget(response([]), response([]), []), undefined);
  assert.throws(() => readSkyTarget(response([sgrA, sgrA]), identifiers, []), /more than one object/u);
  assert.throws(() => readSkyTarget(response([sgrA], { ra: 'rad', dec: 'deg', coo_err_maj: 'mas' }), identifiers, []), /not in degrees/u);
  assert.throws(() => readSkyTarget(response([sgrA], { ra: 'deg', dec: 'deg', coo_err_maj: 'arcsec' }), identifiers, []), /not in milliarcseconds/u);
  assert.throws(() => readSkyTarget(response([{ ...sgrA, dec: -91 }]), identifiers, []), /angular domain/u);
  const noError = readSkyTarget(response([{ ...sgrA, coo_err_maj: null }]), identifiers, [])!;
  assert.equal(noError.positionErrorMas, null); assert.equal(skyRegion(noError), undefined);
  assert.match(simbadObjectQuery("Barnard's star"), /ident\.id = 'Barnard''s star'/u);
});

test('a saved sky target is validated and reused; one that does not derive its id is refused', () => {
  const target = readSkyTarget(response([sgrA]), identifiers, [])!;
  assert.deepEqual(parseSkyTarget(JSON.parse(JSON.stringify(target))), target);
  assert.throws(() => parseSkyTarget({ ...target, id: 'simbad-other' }), /does not derive/u);
});

test('explore asks SIMBAD only for a name the catalogue does not know, and keeps a supplied circle', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'sky-target-')); await mkdir(resolve(root, 'src/objects'), { recursive: true });
  const target: SkyTarget = readSkyTarget(response([sgrA]), identifiers, [])!;
  const asked: string[] = [], resolveSky = async (_root: string, name: string) => { asked.push(name); return name === 'Sgr A*' ? target : undefined; };
  const found = await skyTargetRequest(root, { target: 'Sgr A*', kind: 'cube' }, resolveSky);
  assert.equal(found.request.target, 'simbad-name-sgr-a'); assert.equal(found.request.skyTarget, target); assert.deepEqual(found.request.region, skyRegion(target));
  const circle = { frame: 'icrs' as const, shape: 'circle' as const, raDegrees: 266.4, decDegrees: -29, radiusDegrees: 0.001 };
  assert.deepEqual((await skyTargetRequest(root, { target: 'Sgr A*', region: circle }, resolveSky)).request.region, circle);
  assert.deepEqual(await skyTargetRequest(root, { target: 'nothing' }, resolveSky), { request: { target: 'nothing' }, simbadMiss: true });
  const saved = await skyTargetRequest(root, { target: 'simbad-name-sgr-a', skyTarget: target }, resolveSky);
  assert.equal(saved.request.target, 'simbad-name-sgr-a');
  assert.deepEqual(asked, ['Sgr A*', 'Sgr A*', 'nothing'], 'a saved sky target is not resolved again');
  await assert.rejects(skyTargetRequest(root, { target: 'other', skyTarget: target }, resolveSky), /does not match/u);
});
