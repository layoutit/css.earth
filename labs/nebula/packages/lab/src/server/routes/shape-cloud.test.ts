import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseShapeCloudRequest } from './shape-cloud.ts';
import { readShapeCloudResult } from '../../features/shape-cloud/result.ts';
import { initializeShapeCloud } from '../../features/shape-cloud/model.ts';

function fixture() {
  const settings = initializeShapeCloud({ width: 192, height: 160, groups: [], candidates: [{ id: 'ellipse-1', center: [90, 70], radii: [40, 30],
    angleRadians: .3, score: .8, coverage: .8, supportedArcs: [{ startRadians: 0, endRadians: Math.PI }] }] });
  return { action: 'apply', imageId: 'test-source', cataloguePath: '.local/nebula-lab/test/catalogue.json', geometryFile: 'geometry.json', width: 192, height: 160, settings };
}
test('shape preview request validates its actual image grid and explicit settings', () => {
  const input = fixture();
  assert.equal(parseShapeCloudRequest(input).settings.components[0]!.x, 90);
  assert.equal(parseShapeCloudRequest(input).quality, 'detailed');
  assert.equal(parseShapeCloudRequest({ ...input, quality: 'draft' }).quality, 'draft');
  for (const changed of [{ width: 1 }, { height: Infinity }, { width: 4096, height: 4096 }, { cataloguePath: '../private.json' },
    { action: 'automatic' }, { quality: 'fastest' }, { geometryFile: 'geometry-changed.json' }, { geometryFile: '../other.json' }, { mystery: true }]) assert.throws(() => parseShapeCloudRequest({ ...input, ...changed }));
  const proposal = 'geometry-01234567-89ab-4cde-8f01-23456789abcd.json';
  assert.equal(parseShapeCloudRequest({ ...input, geometryFile: proposal }).geometryFile, proposal);
  assert.throws(() => parseShapeCloudRequest({ ...input, settings: { ...input.settings, components: [{ ...input.settings.components[0], x: 1000 }] } }));
});
test('completed shape result requires both material references, finite registration and exact settings', () => {
  const input = fixture(), pin = { path: '.local/nebula-lab/test/source.png' };
  const result = { schema: 'cssearth-shape-cloud-result@1', id: '01234567-89ab-4cde-8f01-23456789abcd', imageId: input.imageId,
    geometryFile: input.geometryFile,
    width: 192, height: 160, unitsPerPixel: 10 / 192, empty: false, settings: input.settings,
    source: pin, neutral: { ...pin, path: '.local/nebula-lab/test/neutral.json' }, textured: { ...pin, path: '.local/nebula-lab/test/textured.json' } };
  assert.equal(readShapeCloudResult(result).unitsPerPixel, 10 / 192);
  assert.equal(readShapeCloudResult(result).quality, 'detailed');
  assert.equal(readShapeCloudResult({ ...result, quality: 'draft' }).quality, 'draft');
  assert.equal(readShapeCloudResult(result).preparationVersion, undefined, 'Historical receipts remain readable.');
  assert.equal(readShapeCloudResult({ ...result, preparationVersion: 'tight-support-uniform-pitch@1' }).preparationVersion, 'tight-support-uniform-pitch@1');
  for (const changed of [{ neutral: undefined }, { textured: undefined }, { unitsPerPixel: NaN }, { unitsPerPixel: .5 }, { empty: true },
    { quality: 'unknown' }, { preparationVersion: 1 }, { preparationVersion: 'invalid' },
    { source: { ...pin, path: '.local/nebula-lab/../../outside.png' } }]) assert.throws(() => readShapeCloudResult({ ...result, ...changed }));
  assert.equal(readShapeCloudResult({ ...result, empty: true, neutral: undefined, textured: undefined }).empty, true);
  const comparison = { schema: 'cssearth-shape-cloud-comparison@1', width: result.width, height: result.height, brightnessScale: 1,
    metrics: { missingFraction: .5, excessFraction: .2, normalizedRmse: .3 }, levels: [1, 2, 4, 8].map(gain => ({
      gain, source: pin, model: pin, sourceEdges: pin, modelEdges: pin, difference: pin })) };
  assert.deepEqual(readShapeCloudResult({ ...result, comparison }).comparison, comparison);
  for (const change of [{ width: 191 }, { brightnessScale: NaN }, { levels: comparison.levels.slice(1) },
    { levels: comparison.levels.map(level => ({ ...level, gain: 1 })) },
    { levels: comparison.levels.map(level => ({ ...level, model: { ...pin, bytes: 1 } })) }])
    assert.throws(() => readShapeCloudResult({ ...result, comparison: { ...comparison, ...change } }));
});
