import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parsePublishedBodyEpochRecord, parsePublishedParameters } from './published-orbit.ts';
const read = (path: string): unknown => JSON.parse(readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8'));
const body = (): Record<string, unknown> => JSON.parse(readFileSync(new URL('../../../../src/objects/romulus/source/validation/epoch-state.json', import.meta.url), 'utf8'));
const parameters = () => read(`src/objects/romulus/${(body().source as {path:string}).path}`);
test('published orbit and body records retain uninterpreted source provenance', () => {
  assert.deepEqual(parsePublishedBodyEpochRecord(body()), body());
  assert.deepEqual(parsePublishedParameters(parameters()), parameters());
  assert.equal(parsePublishedBodyEpochRecord({ ...body(), opaque: { retained: true } }).schema, body().schema);
});
test('published record diagnostics retain nested field names and structural-only admission', () => {
  assert.throws(() => parsePublishedBodyEpochRecord({ ...body(), positionKm: [1, '2', 3] }), { message: 'Source field positionKm: value must be finite' });
  assert.throws(() => parsePublishedBodyEpochRecord({ ...body(), positionKm: [1, 2] }), { message: 'Source field positionKm: A source vector requires exactly three components' });
  assert.throws(() => parsePublishedParameters({ ...parsePublishedParameters(parameters()), eccentricity: '0' }), { message: 'Source field eccentricity: value must be finite' });
  assert.equal(parsePublishedParameters({ ...parsePublishedParameters(parameters()), eccentricity: 2 }).eccentricity, 2, 'scientific evaluation stays with astronomy');
  assert.throws(() => parsePublishedBodyEpochRecord(null), { message: 'record must be an object' });
});
test('astronomy imports published readers while retaining scientific evaluation', () => {
  const owner = readFileSync(new URL('../../../astronomy/cli/lib/ephemeris-records.mts', import.meta.url), 'utf8');
  const caller = readFileSync(new URL('../../../astronomy/cli/body-epoch-ephemeris.mts', import.meta.url), 'utf8');
  assert.doesNotMatch(owner, /(?:const|function)\s+(?:publishedRecord|parsePublishedParameters|parsePublishedBodyEpochRecord)\b/u);
  assert.match(owner, /\? parsePublishedBodyEpochRecord\(value\)/u);
  assert.match(caller, /const parameters = parsePublishedParameters\(JSON\.parse/u);
  assert.match(caller, /export function evaluatePublishedOrbit/u);
});
