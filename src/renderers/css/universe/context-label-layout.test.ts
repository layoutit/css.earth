import { expect, test } from 'vitest';
import { compactOrbitFootprint, selectContextLabels } from './context-label-layout.js';
import type { ContextLabelCandidate } from './context-label-layout.js';

const label = (id: string, priority: number, distanceM: number, left = 0): ContextLabelCandidate =>
  ({ id, priority, distanceM, rect: { left, top: 0, right: left + 40, bottom: 14 } });

test('overlap reserves Sun before planets before moons, then nearer distance and stable identity', () => {
  const labels = [label('moon', 2, 1), label('planet', 1, 2), label('focus', 0, 100), label('separate', 2, 1, 60)];
  expect(selectContextLabels(labels, 800, 600).map(candidate => candidate.id)).toEqual(['focus', 'separate']);
  expect(selectContextLabels(labels.slice(0, 2), 800, 600).map(candidate => candidate.id)).toEqual(['planet']);
  const peers = [label('z', 1, 2), label('b', 1, 1), label('a', 1, 1)];
  for (const order of [peers, [...peers].reverse()]) expect(selectContextLabels(order, 800, 600).map(candidate => candidate.id)).toEqual(['a']);
  expect(selectContextLabels([label('outside', 0, 1, 390)], 800, 600)).toEqual([]);
});

test('only a compact fully framed orbit footprint excludes background labels', () => {
  const bounds = { left: -75, top: -217, right: 320, bottom: 30 };
  expect(compactOrbitFootprint(bounds, 1440, 900)).toBe(bounds);
  for (const altered of [{ ...bounds, left: -720 }, { ...bounds, right: 720 }, { ...bounds, top: -450 },
    { left: -700, right: 700, top: -400, bottom: 400 }, { ...bounds, left: Infinity }]) {
    expect(compactOrbitFootprint(altered, 1440, 900)).toBeNull();
  }
});
