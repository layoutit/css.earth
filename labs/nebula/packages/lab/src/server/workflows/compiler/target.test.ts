import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { EvidenceInputs, EvidenceSource } from '@cssearth/nebula-reconstruction/evidence/model';
import { compilerTarget, readCompilerTargetControls } from '@cssearth/nebula-reconstruction/methods/inference/target';
import { createEmissionWindowSampler, type EmissionWindow } from '@cssearth/bake/volume';
import { readCompilerRecipe } from '../../../features/compiler/model.ts';
function inputs(width = 100, height = 100): EvidenceInputs {
  const length = width * height;
  const plane = () => ({ signal: new Float32Array(length), coverage: new Uint8Array(length), noiseSigma: 1 });
  const source: EvidenceSource = { id: 'observed', label: 'observed', sourceSha256: '', mapSha256: '', sourcePanelSha256: '',
    imageToFrame: [1, 0, 0, 1, 0, 0], workingWidth: width, workingHeight: height, registeredRgba: new Uint8Array(length * 4),
    footprint: new Uint8Array(length), channels: { broad: plane(), ridges: plane(), compact: plane() },
    ridgeDirectionX: new Float32Array(length), ridgeDirectionY: new Float32Array(length), samplingArcseconds: 1 };
  return { identity: 'fixture', grid: { width, height, frameWidth: width, frameHeight: height, originX: 0, originY: 0,
    extentWidth: width, extentHeight: height, fieldArcminutes: [width / 60, height / 60], arcsecondsPerPixel: 1 }, sources: [source],
    method: { version: 'fixture', scaleArcseconds: [], samplingLimitation: '', normalization: '', boundary: '' } };
}
function pixel(input: EvidenceInputs, x: number, y: number, value: number) {
  const p = y * input.grid.width + x, s = input.sources[0]!; s.footprint[p] = 1; s.registeredRgba.set([value, value, value, 255], p * 4);
}
test('lower background subtraction recovers observed faint emission without elevating measured dark pixels', () => {
  const input = inputs();
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) pixel(input, x, y, [20, 40, 60, 200][Math.floor(x / 25)]!);
  const original = structuredClone(input), before = compilerTarget(input, [1]);
  const after = compilerTarget(input, [1], [0, 0], { sources: { observed: { backgroundSpread: .5, edgeTaperArcsec: 0 } } });
  assert.equal(before.target[55], 0);
  assert.ok(after.target[55]! > .1);
  assert.equal(after.target[5], 0);
  assert.deepEqual(after.coverage, before.coverage);
  assert.deepEqual(after.bounds, before.bounds);
  assert.deepEqual(input, original);
  const historical = compilerTarget(input, [1], [0, 0], { sources: { observed: { backgroundSpread: 1.5, edgeTaperArcsec: 0 } } });
  assert.deepEqual(historical.target, before.target);
});
test('angular footprint reliability suppresses a source edge while retaining internal emission and no-data', () => {
  const input = inputs(128, 128);
  for (let y = 16; y < 112; y++) for (let x = 16; x < 112; x++) pixel(input, x, y,
    (x < 20 || x >= 60 && x < 68) && y >= 50 && y < 80 ? 200 : 0);
  const before = compilerTarget(input, [1]);
  const after = compilerTarget(input, [1], [0, 0], { sources: { observed: { backgroundSpread: 1.5, edgeTaperArcsec: 10 } } });
  const edge = 60 * 128 + 16, center = 60 * 128 + 64;
  assert.ok(before.target[edge]! > .9);
  assert.ok(after.target[edge]! < before.target[edge]! * .02);
  assert.equal(after.target[center], before.target[center]);
  assert.deepEqual(after.coverage, before.coverage);
  assert.equal(after.coverage[0], 0);
  assert.equal(after.target[0], 0);
  assert.deepEqual(after.bounds, before.bounds);
});
test('the saved Lagoon recipe fades every source boundary and the common outer window while retaining interior light', async () => {
  const recipe = readCompilerRecipe(JSON.parse(await readFile('labs/nebula/models/m8/compiler.json', 'utf8')));
  const ids = Object.keys(recipe.sourceWeights ?? {}), input = inputs(128, 128);
  assert.ok(ids.length > 0);
  input.grid.arcsecondsPerPixel = 60; input.grid.fieldArcminutes = [128, 128];
  for (let y = 16; y < 112; y++) for (let x = 16; x < 112; x++) pixel(input, x, y,
    (x < 20 || x >= 60 && x < 68) && y >= 50 && y < 80 ? 200 : 0);
  input.sources = ids.map(id => ({ ...structuredClone(input.sources[0]!), id }));
  const original = structuredClone(input), edge = 60 * 128 + 16, center = 60 * 128 + 64;
  const sourceEdges = (controls: typeof recipe.targetControls) => {
    for (let index = 0; index < ids.length; index++) {
      const weights = ids.map((_id, i) => i === index ? 1 : 0), before = compilerTarget(input, weights);
      const after = compilerTarget(input, weights, [0, 0], controls);
      assert.ok(after.target[edge]! < before.target[edge]! * .08, `${ids[index]} retains a hard source boundary`);
      assert.equal(after.target[center], before.target[center]);
      assert.deepEqual(after.coverage, before.coverage);
    }
  };
  sourceEdges(recipe.targetControls);
  assert.throws(() => sourceEdges(undefined), /hard source boundary/, 'Removing the saved controls must fail the boundary check.');
  assert.ok(recipe.emissionWindow);
  const outerEdge = (featherArcsec: number) => {
    const sample = createEmissionWindowSampler({ sourceId: recipe.emissionWindow!.sourceId, featherArcsec,
      polygonArcsec: [[-3000, -3000], [3000, -3000], [3000, 3000], [-3000, 3000]], interpretation: 'Configured outer-fade test.' });
    assert.equal(sample(-3000, 0), 0); assert.equal(sample(0, 0), 1);
    assert.ok(sample(-2910, 0) < .15, 'The old 90 arcsecond outer strip must fade gradually.');
  };
  outerEdge(recipe.emissionWindow.featherArcsec);
  assert.throws(() => outerEdge(90), /fade gradually/, 'Restoring the narrow historical feather must fail.');
  assert.deepEqual(input, original);
});
test('target controls reject unknown sources, malformed values and unsupported switches', () => {
  for (const v of [{ sources: { observed: { backgroundSpread: -1, edgeTaperArcsec: 0 } } },
    { sources: { observed: { backgroundSpread: 1, edgeTaperArcsec: NaN } } },
    { sources: {}, invented: true }, { sources: { observed: { backgroundSpread: 1, edgeTaperArcsec: 1, crop: true } } }])
    assert.throws(() => readCompilerTargetControls(v), TypeError);
  assert.throws(() => compilerTarget(inputs(), [1], [0, 0], { sources: { unknown: { backgroundSpread: 1, edgeTaperArcsec: 0 } } }), /unavailable/);
});

test('an explicitly downweighted isolated footprint has no hidden normalized-mean brightness floor', () => {
  const input = inputs();
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) pixel(input, x, y, x > 90 ? 200 : 0);
  const controls = { sources: {}, minimumWeightNormalization: 1 };
  const full = compilerTarget(input, [1], [0, 0], controls), faint = compilerTarget(input, [.04], [0, 0], controls);
  assert.ok(Math.abs(faint.target[99]! / full.target[99]! - .04) < 1e-7);
  const historical = compilerTarget(input, [.04]);
  assert.ok(historical.target[99]! / full.target[99]! > .3, 'counterfactual: per-pixel renormalization cancels low source weight');
  assert.deepEqual(faint.coverage, full.coverage);
});

test('an authored rotated optical window trims all source contributions without cropping observed rasters', () => {
  const input = inputs(100, 100);
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) pixel(input, x, y, (x + y) % 4 === 0 ? 200 : 0);
  const before = compilerTarget(input, [1]), unchanged = structuredClone(input);
  const window: EmissionWindow = { sourceId: 'observed', polygonArcsec: [[0, 40], [40, 0], [0, -40], [-40, 0]], featherArcsec: 5, interpretation: 'Explicit display crop.' };
  const after = compilerTarget(input, [1], [0, 0], undefined, window), sample = createEmissionWindowSampler(window);
  let excludedPositive = 0, keptPositive = 0;
  for (let p = 0; p < after.target.length; p++) {
    const weight = sample(-50 + p % 100 + .5, 50 - Math.floor(p / 100) - .5);
    if (weight === 0 && before.target[p]! > 0) { excludedPositive++; assert.equal(after.target[p], 0); }
    if (weight === 1 && before.target[p]! > 0) { keptPositive++; assert.equal(after.target[p], before.target[p]); }
  }
  assert.ok(excludedPositive > 100 && keptPositive > 100);
  assert.deepEqual(after.emissionWindow, window);
  assert.deepEqual(after.coverage, before.coverage); assert.deepEqual(after.bounds, before.bounds); assert.deepEqual(input, unchanged);
});
