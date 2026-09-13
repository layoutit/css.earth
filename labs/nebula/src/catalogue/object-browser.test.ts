import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { arcseconds, objectExtent, orderObjects, type ObjectAppearance } from './object-browser';
import type { MessierObject } from './types';

const object = (messier: number, majorArcmin: number | null): MessierObject => ({ id: `m${messier}`, messier,
  name: `Object ${messier}`, aliases: [], type: 'Nebula', raDegrees: 0, decDegrees: 0, majorArcmin, minorArcmin: null, sourceIds: ['source'] });
test('largest-first uses apparent object extent and puts unknown sizes last', () => {
  const objects = [object(1, null), object(2, 12), object(3, 100), object(4, .1)];
  assert.deepEqual(orderObjects(objects, 'size', new Map()).map(value => value.id), ['m3', 'm2', 'm4', 'm1']);
  assert.equal(objectExtent(objects[1]!).majorArcsec, 720);
  assert.equal(arcseconds(null), 'Size unknown');
});
test('a sourced nebula extent can supersede its associated cluster, never the survey preview field', () => {
  const appearance: ObjectAppearance = { thumbnail: { url: 'https://example.org/preview.jpg', sourceUrl: 'https://example.org', credit: 'survey', fieldArcsec: 50000 },
    extent: { majorArcsec: 3600, minorArcsec: 1200, sourceUrl: 'https://example.org/size', label: 'Nebula extent' } };
  const small = object(1, 1), large = object(2, 100);
  assert.equal(objectExtent(small, appearance).majorArcsec, 3600);
  assert.equal(objectExtent(small, { thumbnail: appearance.thumbnail }).majorArcsec, 60);
  assert.deepEqual(orderObjects([small, large], 'size', new Map([['m1', appearance]])).map(value => value.id), ['m2', 'm1']);
  assert.equal(small.majorArcmin, 1, 'Browsing must not rewrite the query catalogue.');
});
