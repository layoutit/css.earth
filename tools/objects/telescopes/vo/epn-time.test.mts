import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { normalizeSnapshot, SERVICES } from './discovery.mts';
import type { DiscoverySnapshot } from './contracts.mts';

const field = (name: string, attributes = '') => `<FIELD name="${name}" ID="${name}" datatype="${name === 'time_scale' || name === 'time_refposition' ? 'char' : 'double'}"${name === 'time_scale' || name === 'time_refposition' ? ' arraysize="*"' : ' unit="d"'}${attributes}/>`;
const xml = (fields: string, values: string, systems = '') => `<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">${systems}<RESOURCE type="results"><INFO name="QUERY_STATUS" value="OK"/><TABLE>${fields}<DATA><TABLEDATA><TR>${values}</TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
async function parse(document: string) {
  const directory = await mkdtemp(resolve(tmpdir(), 'epn-time-')), file = resolve(directory, 'epn.xml');
  try {
    await writeFile(file, document);
    return (await astroquery({ operation: 'vo-parse', file, url: 'https://example.org/epn', byteLimit: 10000, timeFormat: 'jd', timeModel: 'epn-tap-2.0' })).vo!;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('EPN time defaults to UTC, preserves raw values, and rejects a missing unit', async () => {
  const declared = await parse(xml(field('time_min'), '<TD>2451545</TD>'));
  assert.equal(declared.rows[0]!.time_min, 2451545);
  assert.equal(declared.times[0]!.time_min, '2000-01-01T12:00:00.000Z');
  const missingUnit = await parse(xml('<FIELD name="time_min" ID="time_min" datatype="double"/>', '<TD>2451545</TD>'));
  assert.equal(missingUnit.times[0]!.time_min, null);
  assert.ok(missingUnit.issues.some(issue => issue.includes('Time unit is not days')));
});

test('UTC fallback is EPN-model scoped and blank row metadata remains absent', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'epn-time-generic-')), file = resolve(directory, 'generic.xml');
  try {
    await writeFile(file, xml(field('time_min'), '<TD>2451545</TD>'));
    const generic = (await astroquery({ operation: 'vo-parse', file, url: 'https://example.org/generic', byteLimit: 10000, timeFormat: 'jd' })).vo!;
    assert.equal(generic.times[0]!.time_min, null);
  } finally { await rm(directory, { recursive: true, force: true }); }
  const blank = await parse(xml(field('time_min') + field('time_scale') + field('time_refposition'), '<TD>2451545</TD><TD> </TD><TD> </TD>'));
  assert.equal(blank.times[0]!.time_min, '2000-01-01T12:00:00.000Z');
});

test('EPN row scales override the UTC fallback and explicit TIMESYS converts with Astropy', async () => {
  const rowScale = await parse(xml(field('time_min') + field('time_scale'), '<TD>2451545</TD><TD>TT</TD>'));
  assert.equal(rowScale.times[0]!.time_min, '2000-01-01T11:58:55.816Z');
  const system = '<TIMESYS ID="clock" timescale="TDB" refposition="BARYCENTER" timeorigin="JD-origin"/>';
  const referenced = await parse(xml(field('time_min', ' ref="clock"'), '<TD>2451545</TD>', system));
  assert.equal(referenced.times[0]!.time_min, '2000-01-01T11:58:55.816Z');
});

test('EPN contradictory or unresolved TIMESYS metadata refuses normalization', async () => {
  const system = '<TIMESYS ID="clock" timescale="TT" refposition="GEOCENTER" timeorigin="JD-origin"/>';
  const scaleConflict = await parse(xml(field('time_min', ' ref="clock"') + field('time_scale'), '<TD>2451545</TD><TD>TDB</TD>', system));
  assert.equal(scaleConflict.times[0]!.time_min, null);
  assert.ok(scaleConflict.issues.some(issue => issue.includes('conflicts with EPN time_scale')));
  const referenceConflict = await parse(xml(field('time_min', ' ref="clock"') + field('time_refposition'), '<TD>2451545</TD><TD>BARYCENTER</TD>', system));
  assert.equal(referenceConflict.times[0]!.time_min, null);
  assert.ok(referenceConflict.issues.some(issue => issue.includes('reference position conflicts')));
  const unresolved = await parse(xml(field('time_min', ' ref="missing"'), '<TD>2451545</TD>', system));
  assert.equal(unresolved.times[0]!.time_min, null);
  assert.ok(unresolved.issues.some(issue => issue.includes('unresolved or ambiguous TIMESYS')));
});

test('EPN rejects malformed scales and incompatible time origins', async () => {
  const malformed = await parse(xml(field('time_min') + field('time_scale'), '<TD>2451545</TD><TD>not a time scale</TD>'));
  assert.equal(malformed.times[0]!.time_min, null);
  assert.ok(malformed.issues.some(issue => issue.includes('not a time scale')));
  const origin = '<TIMESYS ID="clock" timescale="UTC" timeorigin="2400000.5"/>';
  const incompatibleOrigin = await parse(xml(field('time_min', ' ref="clock"'), '<TD>2451545</TD>', origin));
  assert.equal(incompatibleOrigin.times[0]!.time_min, null);
  assert.ok(incompatibleOrigin.issues.some(issue => issue.includes('origin disagrees')));
});

test('EPN normalization reads the standard spatial coordinate description', async () => {
  const spatialFields = '<FIELD name="granule_uid" ID="granule_uid" datatype="char" arraysize="*"/><FIELD name="target_name" ID="target_name" datatype="char" arraysize="*"/><FIELD name="spatial_frame_type" ID="spatial_frame_type" datatype="char" arraysize="*"/><FIELD name="spatial_coordinate_description" ID="spatial_coordinate_description" datatype="char" arraysize="*"/>';
  const response = await parse(xml(spatialFields, '<TD>row-1</TD><TD>Mars</TD><TD>body</TD><TD>IAU2020:49900</TD>'));
  const profile = SERVICES[2]!, snapshot: DiscoverySnapshot = { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: 'epn-tap-2.0',
    request: {}, query: 'SELECT', scope: 'fixture', sampleLimit: 1, response, completeness: 'bounded-sample' };
  const target = { id: 'mars', names: ['Mars'] };
  assert.equal(normalizeSnapshot(snapshot, profile, target, [target])[0]!.spatial.description, 'IAU2020:49900');
});
