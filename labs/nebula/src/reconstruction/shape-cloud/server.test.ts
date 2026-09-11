import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseShapeCloudRequest } from './server.js';
import { readShapeCloudResult } from './result.js';
import { initializeShapeCloud } from './model.js';

function fixture() {
  const settings = initializeShapeCloud({ width: 192, height: 160, groups: [], candidates: [{ id: 'ellipse-1', center: [90, 70], radii: [40, 30],
    angleRadians: .3, score: .8, coverage: .8, supportedArcs: [{ startRadians: 0, endRadians: Math.PI }] }] });
  return { action: 'apply', imageId: 'test-source', cataloguePath: '.local/nebula-lab/test/catalogue.json', geometrySha256: 'a'.repeat(64), width: 192, height: 160, settings };
}
test('shape preview request validates its actual image grid and explicit settings', () => {
  const input = fixture();
  assert.equal(parseShapeCloudRequest(input).settings.components[0]!.x, 90);
  for (const changed of [{ width: 1 }, { height: Infinity }, { width: 4096, height: 4096 }, { cataloguePath: '../private.json' },
    { action: 'automatic' }, { geometrySha256: 'changed' }, { mystery: true }]) assert.throws(() => parseShapeCloudRequest({ ...input, ...changed }));
  assert.throws(() => parseShapeCloudRequest({ ...input, settings: { ...input.settings, components: [{ ...input.settings.components[0], x: 1000 }] } }));
});
test('completed shape result requires both material pins, finite registration and exact settings', () => {
  const input = fixture(), pin = { path: '.local/nebula-lab/test/source.png', sha256: 'b'.repeat(64) };
  const result = { schema: 'cssearth-shape-cloud-result@1', id: 'c'.repeat(64), imageId: input.imageId,
    sourceSha256: 'd'.repeat(64), mapSha256: 'e'.repeat(64), geometrySha256: input.geometrySha256,
    width: 192, height: 160, unitsPerPixel: 10 / 192, empty: false, settings: input.settings,
    source: pin, neutral: { ...pin, path: '.local/nebula-lab/test/neutral.json' }, textured: { ...pin, path: '.local/nebula-lab/test/textured.json' } };
  assert.equal(readShapeCloudResult(result).unitsPerPixel, 10 / 192);
  for (const changed of [{ neutral: undefined }, { textured: undefined }, { unitsPerPixel: NaN }, { unitsPerPixel: .5 }, { empty: true },
    { source: { ...pin, path: '.local/nebula-lab/../../outside.png' } }]) assert.throws(() => readShapeCloudResult({ ...result, ...changed }));
  assert.equal(readShapeCloudResult({ ...result, empty: true, neutral: undefined, textured: undefined }).empty, true);
});
