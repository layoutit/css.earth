import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DISPLAY_ORIENTATION_SCHEMA, parseAuthoredOrientation } from './display-orientation.js';

const record = { schema: DISPLAY_ORIENTATION_SCHEMA, rightAscensionDegrees: 10, declinationDegrees: -90,
  displayMeridianDegrees: 0, phase: 'arbitrary-display-phase', qualification: 'illustrative' };
test('display orientation preserves numeric and attribution admission', () => {
  assert.equal(DISPLAY_ORIENTATION_SCHEMA, 'cssearth-display-orientation@1');
  assert.deepEqual(parseAuthoredOrientation(record), { rightAscensionDegrees: 10, declinationDegrees: -90, displayMeridianDegrees: 0, periodHours: 0 });
  for (const patch of [{ schema: 'other' }, { phase: 'measured' }, { qualification: '' }, { qualification: ' ' }, { declinationDegrees: 91 }])
    assert.throws(() => parseAuthoredOrientation({ ...record, ...patch }), { message: 'Invalid authored orientation source.' });
  assert.throws(() => parseAuthoredOrientation({ ...record, rightAscensionDegrees: Infinity }), TypeError);
  assert.equal(parseAuthoredOrientation({ ...record, periodHours: 0 }).periodHours, 0);
});
test('observed-pole field policy preserves positive periods and optional qualification', () => {
  assert.equal(parseAuthoredOrientation({ ...record, qualification: undefined, periodHours: 24 }, { observed: true }).periodHours, 24);
  assert.throws(() => parseAuthoredOrientation({ ...record, periodHours: 0 }, { observed: true }), { message: 'Invalid authored orientation source.' });
});
test('preserved Python display-orientation writer conforms to the shared identifier', () => {
  const python = readFileSync(new URL('../../../bake/authoring/distant-worlds/author.py', import.meta.url), 'utf8');
  const literal = /write\(source\/'preparation\/rotation\.json',dict\(schema='([^']+)'/u.exec(python)?.[1];
  assert.equal(literal, DISPLAY_ORIENTATION_SCHEMA);
});
