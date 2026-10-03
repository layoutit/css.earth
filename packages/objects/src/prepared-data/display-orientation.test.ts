import assert from 'node:assert/strict';
import test from 'node:test';
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
