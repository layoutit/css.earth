import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filamentMap, lineStrengths } from './filaments.ts';

test('a dark line is a filament and a dark spot of the same depth is far less of one', () => {
  const width = 64, height = 64, brightness = new Float32Array(width * height).fill(.8), lit = new Uint8Array(width * height).fill(1);
  for (let y = 0; y < height; y++) for (const x of [40, 41]) brightness[y * width + x] = .3;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (Math.hypot(x - 16, y - 32) < 3) brightness[y * width + x] = .3;
  const [strength] = lineStrengths(brightness, width, height, lit, [1.5]), line = strength![32 * width + 40]!, spot = strength![32 * width + 16]!;
  assert.ok(line > 0.5, `the line: ${line}`);
  assert.ok(spot < line / 2, `the spot ${spot} against the line ${line}`);
  // The map: a weighted image's strength, less the threshold, times the gain.
  const map = filamentMap([[strength!]], { sources: [1], widths: [1], threshold: .1, gain: 2, gamma: 1 });
  assert.equal(map[32 * width + 40], Math.min(1, Math.max(0, line - .1) / .9 * 2));
  assert.equal(map[10 * width + 2], 0, 'flat light is no filament');
});
