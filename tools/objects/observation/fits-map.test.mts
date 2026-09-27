import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { prepareFitsMap, type FitsMapRecipe, createSolarSynopticInterpreter } from '@cssearth/bake/objects/layers/observation';
import { parseSynopticRecipe } from './interpret.mts';
import { readFitsPrimary } from '@cssearth/fits';

const test = sourceTest('sun');
const recipe: FitsMapRecipe = { bitpix: -64, width: 4, height: 2, latitude: 'equirectangular', nearestLatitudeLimit: 0,
  missingCoverage: 'gray', color: { kind: 'positive-log', range: [1, 1000], palette: [[0, 0, 0], [255, 255, 255]] } };
function fixture() {
  const bytes = Buffer.alloc(5760), cards = ["SIMPLE  =                    T", "BITPIX  =                  -64", "NAXIS   =                    2",
    "NAXIS1  =                    4", "NAXIS2  =                    2", "BLANK   =                 1000", 'END'];
  bytes.fill(32, 0, 2880);
  cards.forEach((card, i) => bytes.write(card.padEnd(80), i * 80, 'ascii'));
  // Native row 0 is south; the displayed top row must come from native row 1.
  [1, 10, 100, 1000, -1, 0, 1000, NaN].forEach((v, i) => bytes.writeDoubleBE(v, 2880 + i * 8));
  return bytes;
}

test('equal-latitude pixel centres preserve north, south, valid dark values and float BLANK values', () => {
  const map = prepareFitsMap(fixture(), 4, 2, recipe), pixel = (i: number) => [...map.subarray(i * 4, i * 4 + 4)];
  assert.deepEqual(pixel(0), [0, 0, 0, 255]);
  assert.deepEqual(pixel(1), [0, 0, 0, 255]);
  assert.deepEqual(pixel(2), [255, 255, 255, 255]); // A floating 1000 is measured, despite BLANK=1000.
  assert.ok(pixel(3)[0]! >= 82 && pixel(3)[0]! <= 112, 'NaN receives the gray gap pattern');
  assert.deepEqual([4, 5, 6, 7].map(i => pixel(i)[0]), [0, 85, 170, 255]);
  assert.throws(() => prepareFitsMap(fixture(), 4, 2, { ...recipe, nearestLatitudeLimit: 1 }), /cannot use latitude/);
  assert.throws(() => parseSynopticRecipe({ kind: 'fits-map', fits: recipe, limb: { mode: 'rim' }, offLimb: null,
    polarStabilization: { latitudeSegments: 16, polarDetailSigma: 0.8 } }), /cannot use polar/);
});

test('the three native AIA maps identify the same rotation and retain actual missing samples', async () => {
  const sourceDirectory = resolve('src/objects/sun/source');
  const raster: unknown = JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/raster.json'), 'utf8'));
  assert.ok(raster && typeof raster === 'object' && 'surfaces' in raster && Array.isArray(raster.surfaces));
  const interpreter = createSolarSynopticInterpreter({ sourceDirectory, emission: { offLimbSize: 16, limbSize: 16, bodyDiameter: 12 } });
  for (const [id, wave] of [['chromosphere', 304], ['corona', 171], ['corona-193', 193]] as const) {
    const surface: unknown = raster.surfaces.find((s: unknown) => s && typeof s === 'object' && 'id' in s && s.id === id);
    assert.ok(surface && typeof surface === 'object' && 'source' in surface && typeof surface.source === 'string' && 'science' in surface);
    const science = surface.science;
    assert.ok(science && typeof science === 'object' && 'synoptic' in science);
    const plan = parseSynopticRecipe(science.synoptic), file = resolve(sourceDirectory, surface.source);
    const bytes = await readFile(file), native = readFitsPrimary(bytes);
    assert.equal(native.header.CAR_ROT, '2311');
    assert.match(native.header.WAVELNTH!, new RegExp(`^'${wave} = `));
    assert.equal(native.header.T_START, "'2026.5.12_21:56:1_TAI'");
    assert.equal(native.header.T_STOP, "'2026.6.9_2:57:22_TAI'");
    assert.ok(native.values.some(v => !Number.isFinite(v)));
    // Independent byte anchors in the documented one-record primary header layout.
    for (const i of [0, 3600 * 270 + 901, 3600 * 540 + 1800, 3600 * 810 + 2701])
      assert.equal(native.values[i], bytes.readDoubleBE(2880 + i * 8));
    assert.equal(plan.polarStabilization, undefined);
    const rendered = await interpreter.interpret(plan, file, 360, 108, 1);
    assert.ok(rendered.plates.offLimb.data.every(v => v === 0), 'No separate photograph survives in the off-limb plate');
  }
});
