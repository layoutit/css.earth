import { expect, test } from 'vitest';
import { compactOrbitFootprint } from './context-label-layout.js';

test('only a compact fully framed orbit footprint excludes background labels', () => {
  const bounds = { left: -75, top: -217, right: 320, bottom: 30 };
  expect(compactOrbitFootprint(bounds, 1440, 900)).toBe(bounds);
  for (const altered of [{ ...bounds, left: -720 }, { ...bounds, right: 720 }, { ...bounds, top: -450 },
    { left: -700, right: 700, top: -400, bottom: 400 }, { ...bounds, left: Infinity }]) {
    expect(compactOrbitFootprint(altered, 1440, 900)).toBeNull();
  }
});
