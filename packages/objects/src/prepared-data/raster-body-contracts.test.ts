import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBodyMapProduct, formatBodyMapProduct, assertProductsCombinable } from './body-map-product.js';
import { parseResolutionEvidence, parseAcceptedAssumptions, supportsMeasuredResolution } from './resolution-evidence.js';
import { parseLimbBlock } from './limb-block.js';
import { parseRasterRecipe } from './raster-recipe-parser.js';
import { bodyMapFixture, rasterRecipeFixture } from './raster-body-fixtures.js';
const sizes = () => ({ majorKm: 2, minorKm: 1 });
const inline = <T>(value: T): T => value;
test('resolution evidence preserves receipts, admission and diagnostics', () => {
  const evidence = { kind: 'measured', receipt: { file: 'receipt.json' } } as const;
  assert.deepEqual(parseResolutionEvidence(evidence), evidence);
  assert.equal(supportsMeasuredResolution(evidence), true);
  assert.equal(supportsMeasuredResolution({ kind: 'nominal', receipt: evidence.receipt }), false);
  assert.equal(supportsMeasuredResolution({ kind: 'measured' }), false);
  assert.throws(() => parseResolutionEvidence({ kind: 'invented' }), { name: 'TypeError', message: 'Unknown resolution evidence kind: invented.' });
  assert.deepEqual(parseAcceptedAssumptions(['jwst.archive-point-source', 'jwst.archive-point-source']), ['jwst.archive-point-source']);
  assert.throws(() => parseAcceptedAssumptions(['invented']), { message: 'Unknown resolution assumption: invented.' });
});
test('limb references are data; preserve validation and historically accepted empty reference', () => {
  const models = ['photometry/model.json', 'photometry/model.json', 'photometry/model.json'];
  assert.deepEqual(parseLimbBlock({ models, reference: '' }, 'limb'), { models, reference: '' });
  assert.throws(() => parseLimbBlock({ models, extra: 1 }, 'limb'), { message: 'limb has unknown keys: extra.' });
  assert.throws(() => parseLimbBlock({ models: [] }, 'limb'), { message: 'limb.models must name three records as photometry/<id>.json (red, green, blue), got [].' });
});
test('body product validates and serializes without deriving surface resolution', () => {
  const fixture = bodyMapFixture();
  assert.deepEqual(parseBodyMapProduct(fixture, sizes), fixture);
  assert.equal(formatBodyMapProduct(fixture, sizes), `${JSON.stringify(fixture, null, 2)}\n`);
  assert.throws(() => parseBodyMapProduct({ ...fixture, observations: [] }, sizes), { message: 'A body map names the observations it was made from.' });
  assert.throws(() => parseBodyMapProduct({ ...fixture, schema: 'wrong' }, sizes), { message: 'Unsupported body map schema wrong.' });
  const combined = { ...fixture, combination: { time: { rule: 'same-epoch-only', withinDays: 1 }, resolution: { rule: 'within-factor', factor: 2 } } } as const;
  let reads = 0;
  parseBodyMapProduct(combined, () => { reads++; return sizes(); });
  assert.equal(reads, 2);
  assert.throws(() => assertProductsCombinable([fixture, fixture], { time: { rule: 'time-invariant' }, resolution: { rule: 'as-observed' } }, sizes), /instantaneous state/);
});
test('raster validates inline recipes and preserves resolution position and mutation', () => {
  const fixture = rasterRecipeFixture();
  assert.deepEqual(parseRasterRecipe(fixture, inline), fixture);
  assert.throws(() => parseRasterRecipe({ ...fixture, densities: [1] }, inline), { message: 'The raster lane prepares one canonical density; remove densities.' });
  let called = false;
  assert.throws(() => parseRasterRecipe({ ...fixture, sourceWidth: 0, lighting: { bank: 'test' } }, () => { called = true; throw new Error('resolver'); }), { message: 'raster.sourceWidth must be positive and finite.' });
  assert.equal(called, false);
  const banked = { ...fixture, lighting: { bank: 'test' } };
  assert.throws(() => parseRasterRecipe(banked, () => { called = true; throw new Error('resolver'); }), { message: 'resolver' });
  assert.equal(called, true);
  assert.throws(() => parseRasterRecipe({ ...fixture, atmosphere: { materialOutput: 'a', observationOutput: 'b', lightingOutput: 'c', tileSize: 1, logicalSize: 1, bodyRadius: 1, supersampling: 1, coverageScale: 1, contentScale: 1, frameCount: 1, directionalFrameCount: 1, columns: 1, rows: 1, minimumLightViewZ: -1, maximumLightViewZ: 1, limb: { models: [] } } }, inline), /must name three records/);
});
