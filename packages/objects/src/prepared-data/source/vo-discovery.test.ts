import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canonical, jsonValue, parsePin, parseRegion, parseMetadata, parseSnapshot, VO_METADATA_SCHEMA, VO_DISCOVERY_SCHEMA } from './vo-discovery.ts';
const region = { frame: 'icrs', shape: 'circle', raDegrees: 1, decDegrees: -2, radiusDegrees: 3 };
const metadata = () => ({ schema: VO_METADATA_SCHEMA, pyvo: '1.9.1', raw: { path: 'raw.xml', bytes: 0 }, effectiveUrl: 'https://example.test/tap',
  fetchedAt: '2026-01-01T00:00:00Z', httpStatus: 200, queryStatus: 'OK', fields: [], rows: [], resources: [], times: [], bindings: [], coordinateSystems: [], timeSystems: [], issues: [] });
const snapshot = () => ({ schema: VO_DISCOVERY_SCHEMA, service: 'service', table: 'table', model: 'obscore-1.1', request: {}, query: 'SELECT *', scope: 'sample', sampleLimit: 1, response: metadata(), completeness: 'bounded-sample' });
test('VO nested contracts preserve canonical data and response projections', () => {
  assert.equal(canonical({ z: -0, a: [null, true, 2] }), '{"a":[null,true,2],"z":0}');
  assert.deepEqual(parsePin({ path: 'p', bytes: 0, extra: true }).path, 'p');
});
test('VO metadata and snapshot admit historical empty responses and bounded spatial selections', () => {
  assert.deepEqual(parseMetadata(metadata()), metadata());
  const field = { name: 'flux', id: 'f', datatype: 'double', arraysize: null, unit: 'Jy', ucd: null, utype: null, xtype: null, ref: null };
  const parameter = { ...field, value: [1, null], constraints: { max: 2 } };
  const populated = { ...metadata(), fields: [field], rows: [{ flux: 1 }], times: [{ flux: null }],
    resources: [{ id: null, type: 'meta', utype: null, parameters: [parameter], groups: [{ name: null, parameters: [parameter] }] }],
    bindings: [{ row: 0, serviceId: 'service', url: null, parameters: { flux: 1 }, error: null }], coordinateSystems: [{ frame: 'ICRS' }] };
  assert.deepEqual(parseMetadata(populated), populated);
  assert.throws(() => parseMetadata({ ...populated, fields: [field, field] }), { message: 'Duplicate VO field names.' });
  assert.throws(() => parseMetadata({ ...populated, rows: [{ other: 1 }] }), { message: 'VO row does not match its fields.' });
  assert.throws(() => parseMetadata({ ...populated, bindings: [{ ...populated.bindings[0], row: 1 }] }), { message: 'Service binding has no matching row.' });
  assert.deepEqual(parseSnapshot(snapshot()), snapshot());
  const selected = { ...snapshot(), request: { region }, query: "SELECT * WHERE obs_id IN ('a''b')", spatialSelection: {
    method: 'mast-filtered-position@1', region, collection: '', ids: ["a'b"], complete: false, pin: { path: 'ids.json', bytes: 1 } }, completeness: 'overflow' };
  assert.deepEqual(parseSnapshot(selected), selected);
  assert.deepEqual(parseRegion(region), region);
});
test('VO parsers retain rejection diagnostics and precedence', () => {
  const cases: readonly [() => unknown, string][] = [
    [() => jsonValue(Infinity), 'VO numbers must be finite and lossless.'],
    [() => jsonValue(new Date()), 'VO JSON requires plain records.'],
    [() => parsePin({ path: 'p', bytes: -1 }), 'VO file p: bytes -1 is not a byte count.'],
    [() => parsePin({ path: '', bytes: 0 }), 'VO file : bytes 0 is not a byte count.'],
    [() => parseRegion({ ...region, radiusDegrees: 0 }), 'VO region requires an explicit ICRS circle in degrees.'],
    [() => parseRegion({ ...region, extra: 0 }), 'Unsupported region field extra.'],
    [() => parseMetadata({ ...metadata(), pyvo: 'wrong' }), 'Invalid VO metadata contract, package version or query status.'],
    [() => parseMetadata({ ...metadata(), times: [{}] }), 'VO time coordinates do not match rows.'],
    [() => parseMetadata({ ...metadata(), httpStatus: 500 }), 'VO query status contradicts HTTP failure.'],
    [() => parseSnapshot({ ...snapshot(), schema: 'wrong' }), 'Unsupported VO snapshot.'],
    [() => parseSnapshot({ ...snapshot(), sampleLimit: 0 }), 'Invalid VO sample limit.'],
    [() => parseSnapshot({ ...snapshot(), completeness: 'failed' }), 'VO completeness contradicts response status.'],
  ];
  for (const [parse, message] of cases) assert.throws(parse, { name: 'TypeError', message });
});
test('VO consumers have one metadata and snapshot reader in objects', () => {
  const owner = readFileSync(new URL('../../../../telescope/src/node/vo-contracts.ts', import.meta.url), 'utf8');
  const discovery = readFileSync(new URL('../../../../telescope-cli/src/vo/discovery.mts', import.meta.url), 'utf8');
  const transport = readFileSync(new URL('../../../../telescope/src/node/astroquery.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(owner + discovery, /(?:function|const)\s+(?:parseMetadata|parsePin|parseRegion|parseSnapshot|jsonValue)\b/u);
  assert.match(transport, /const vo = isVo \? parseMetadata\(raw\.vo\)/u);
  assert.match(discovery, /const snapshot = parseSnapshot\(/u);
});
