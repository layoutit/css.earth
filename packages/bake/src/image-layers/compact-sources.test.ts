import assert from 'node:assert/strict';
import { test } from 'node:test';
import { removeCompactSources } from './compact-sources.ts';

const W = 120, H = 80;
/** A picture of one channel's light in red: a wide soft cloud, with the sources given on it. */
const picture = (sources: readonly { x: number; y: number; width: number; light: number }[]) => { const rgb = Buffer.alloc(3 * W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let light = 90 * Math.exp(-((x - 60) ** 2 + (y - 40) ** 2) / (2 * 22 ** 2)); for (const source of sources) light += source.light * Math.exp(-((x - source.x) ** 2 + (y - source.y) ** 2) / (2 * source.width ** 2)); rgb[3 * (y * W + x)] = Math.min(255, Math.round(light)); }
  return rgb; };

test('a point source is taken down to the cloud around it, and the cloud and a wide clump stay', () => {
  const plain = picture([]), wide = { x: 40, y: 40, width: 9, light: 80 }, withSources = picture([{ x: 85, y: 30, width: 1.2, light: 150 }, { x: 20, y: 60, width: 1.2, light: 120 }, wide]), clump = picture([wide]);
  assert.equal(removeCompactSources(withSources, W, H, 3), 2);
  // At the two sources the picture is the cloud's own light again, within a few steps; the wide clump is as it was.
  for (const [x, y] of [[85, 30], [20, 60]] as const) assert.ok(Math.abs(withSources[3 * (y * W + x)]! - plain[3 * (y * W + x)]!) <= 8, `at ${x}, ${y}: ${withSources[3 * (y * W + x)]} against the cloud's ${plain[3 * (y * W + x)]}`);
  assert.equal(withSources[3 * (40 * W + 40)], clump[3 * (40 * W + 40)]);
  // A picture with no source is left as it is.
  const untouched = picture([]); assert.equal(removeCompactSources(untouched, W, H, 3), 0); assert.deepEqual(untouched, plain);
});
