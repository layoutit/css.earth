import { expect, test } from 'vitest';
import { writePieces } from './heliocentric-sprites.js';
import type { OrbitSegment } from './heliocentric-view.js';
import { orbitSegmentTransform } from './orbit-segment-presentation.js';

test('transported line transforms preserve direct publication and later marker reclipping', () => {
  const direct = [{ style: {} }, { style: {} }] as HTMLElement[];
  const transported = [{ style: {} }, { style: {} }] as HTMLElement[];
  const segments: OrbitSegment[] = [[10, 20, 100, 40, .5], [-20, -30, 4, 120, .25]];
  writePieces(direct, segments, 0);
  writePieces(transported, segments, 0, undefined, structuredClone(segments.map(orbitSegmentTransform)));
  expect(transported).toEqual(direct);
  const clipped: OrbitSegment[] = [[15, 21, 100, 40, .5]];
  writePieces(direct, clipped, 2);
  writePieces(transported, clipped, 2);
  expect(transported).toEqual(direct);
  expect(() => writePieces(transported, segments, 1, undefined, [])).toThrow('match');
});

test('retained line publications skip unchanged styles without reading serialized CSS matrices', () => {
  const writes: string[] = [];
  const piece = { style: new Proxy({}, {
    get() { throw new Error('Line publication must not read CSSOM.'); },
    set(_target, key) { writes.push(String(key)); return true; },
  }) } as HTMLElement;
  const line: OrbitSegment = [10, 20, 100, 40, .5];
  const setVisible = () => {};
  writePieces([piece], [line], 0, setVisible);
  expect(writes).toEqual(['transform', 'opacity']); writes.length = 0;
  writePieces([piece], [line], 1, setVisible);
  expect(writes).toEqual([]);
  writePieces([piece], [[11, 21, 101, 41, .5]], 1, setVisible);
  expect(writes).toEqual(['transform']); writes.length = 0;
  writePieces([piece], [[11, 21, 101, 41, .25]], 1, setVisible);
  expect(writes).toEqual(['opacity']);
});
