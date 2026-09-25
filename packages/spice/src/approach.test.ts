import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseApproachRecipe } from './approach.js';

test('an approach recipe states its schema, NAIF ids, window and inbound time', () => {
  const valid = { schema: 'cssearth-spacecraft-approach@1', kernelSet: 'new-horizons', kernels: ['lsk/naif0012.tls'], spacecraft: -98, body: 999,
    frame: 'IAU_PLUTO', searchWindowUtc: ['2015-07-14T08:00:00Z', '2015-07-14T16:00:00Z'], inboundHours: 12 };
  assert.equal(parseApproachRecipe(valid, 'pluto').body, 999);
  assert.throws(() => parseApproachRecipe({ ...valid, schema: 'x' }, 'pluto'), /pluto: schema is x/);
  assert.throws(() => parseApproachRecipe({ ...valid, spacecraft: 'NEW HORIZONS' }, 'pluto'), /pluto: spacecraft is NEW HORIZONS/);
  assert.throws(() => parseApproachRecipe({ ...valid, searchWindowUtc: ['2015-07-14T08:00:00Z'] }, 'pluto'), /searchWindowUtc has 1 instants/);
  assert.throws(() => parseApproachRecipe({ ...valid, inboundHours: 0 }, 'pluto'), /inboundHours is 0/);
});
