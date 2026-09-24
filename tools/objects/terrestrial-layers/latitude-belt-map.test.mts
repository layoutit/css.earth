/** The latitude-belt map reader, and the five Willamo et al. (2022) stars' deposited ZDI maps read against the paper's own numbers. */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { loadLatitudeBeltMap, parseLatitudeBelts } from './latitude-belt-map.mts';

const test = sourceTest();

/** Three belts (4, 8 and 4 cells) at -60, 0 and 60 degrees; the value is the cell's longitude plus its latitude. */
function table(shift = 0) {
  const rows = [];
  for (const [latitude, n] of [[-60, 4], [0, 8], [60, 4]] as const)
    for (let k = 0; k < n; k++) { const longitude = (k + 0.5) * 360 / n + (k === 1 ? shift : 0); rows.push(`${latitude.toFixed(3)} ${longitude.toFixed(3)} ${(longitude + latitude) / 1000} 1`); }
  return `${rows.join('\n')}\n`;
}

test('a belt map keeps every cell value, interpolates around and between belts, and holds the pole belt', async () => {
  const work = await mkdtemp(resolve(tmpdir(), 'belts-'));
  try {
    await writeFile(resolve(work, 'map.dat'), table());
    const map = await loadLatitudeBeltMap(work, { path: 'map.dat', column: 3, valueTransform: { scale: 1000 }, outlineLatitudes: [-65] });
    assert.ok(Math.abs(map.sample(22.5, 0)! - 22.5) < 1e-9, 'a cell centre keeps its value');
    assert.ok(Math.abs(map.sample(33.75, 0)! - 33.75) < 1e-9, 'halfway between two cells of a belt');
    // Halfway from the -60 belt (45 - 60 = -15 at longitude 45) to the equator (45): 15.
    assert.ok(Math.abs(map.sample(45, -30)! - 15) < 1e-9, 'between belts: the mean of the two belt samples');
    assert.ok(Math.abs(map.sample(0, 0)! - (337.5 + 22.5) / 2) < 1e-9, 'the belt wraps at longitude 0');
    assert.equal(map.sample(45, 80), map.sample(45, 60), 'poleward of the last belt its value is held');
    assert.equal(map.outline!(10, -65, 0.5), true);
    await writeFile(resolve(work, 'shifted.dat'), table(5));
    await assert.rejects(loadLatitudeBeltMap(work, { path: 'shifted.dat', column: 3 }), /cell 1 of the belt at -60 is at longitude 140/u);
    await assert.rejects(loadLatitudeBeltMap(work, { path: 'map.dat', column: 2 }), /not a value column/u);
    assert.throws(() => parseLatitudeBelts(table().split('\n').reverse().join('\n'), 'reversed.dat', 3), /south to north/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});

// Willamo et al. (2022, A&A 659, A71), Table 3: the largest and the mean total field of each map, in G.
const PAPER = [
  ['be-ceti', 'becet.dat', 55, 16], ['chi1-orionis', 'chi1ori.dat', 41, 13], ['hd-29615', 'hd29615.dat', 329, 80],
  ['hd-35296', 'hd35296.dat', 58, 21], ['v1358-orionis', 'v1358or2.dat', 154, 50], ['v1358-orionis', 'v1358ori.dat', 195, 58],
] as const;
for (const [id, file, largest, mean] of PAPER) {
  sourceTest(id)(`${id} ${file}: the deposited map has the 1876 cells and the largest and mean field of the paper's Table 3`, async () => {
    const path = `science/willamo-2022/${file}`, text = await readFile(new URL(`../../../src/objects/${id}/source/${path}`, import.meta.url), 'utf8');
    const components = [3, 4, 5].map(column => parseLatitudeBelts(text, path, column).flatMap(belt => belt.values));
    const total = components[0]!.map((_, i) => 1000 * Math.hypot(...components.map(values => values[i]!)));
    assert.equal(total.length, 1876);
    // The cells have equal area, so the mean over cells is the surface mean.
    assert.equal(Math.round(Math.max(...total)), largest);
    assert.equal(Math.round(total.reduce((sum, value) => sum + value, 0) / total.length), mean);
  });
}
