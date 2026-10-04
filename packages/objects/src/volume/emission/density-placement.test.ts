import test from 'node:test';
import assert from 'node:assert/strict';
import { DENSITY_PLACEMENT_SCHEMA, parseDensityPlacement } from './density-placement.ts';

const placement = { schema: DENSITY_PLACEMENT_SCHEMA, scale: 2, rotationZDegrees: 90,
  pivotUnits: [1, 2, 3], translationUnits: [4, 5, 6] };
test('density placement retains coordinates and exact historical diagnostics', () => {
  assert.deepEqual(parseDensityPlacement(placement), placement);
  assert.throws(() => parseDensityPlacement({ ...placement, schema: 'wrong' }),
    { name: 'TypeError', message: 'Invalid authored density placement schema.' });
  for (const scale of [0, -1]) assert.throws(() => parseDensityPlacement({ ...placement, scale }),
    { name: 'TypeError', message: 'Density placement scale must be positive.' });
  for (const key of ['scale', 'rotationZDegrees', 'pivotUnits', 'translationUnits']) {
    for (const value of [null, '1', NaN, Infinity, [], [1, 2], [1, 2, Infinity], [1, 2, 3, 4]])
      assert.throws(() => parseDensityPlacement({ ...placement, [key]: value }), TypeError);
  }
});
