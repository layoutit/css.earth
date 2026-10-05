import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseImageLayerBankDescriptor } from './image-layer-bank.js';

function descriptor() {
  return { schema: 'cssearth-object@2', id: 'cloud', type: 'image-layer-bank', properties: {
    frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 100, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    preparation: { source: 'source/recipe.json' } } };
}
test('parses a renderer-independent spatial image model without assigning measured density', () => {
  assert.partialDeepStrictEqual(parseImageLayerBankDescriptor(descriptor()), { type: 'image-layer-bank', frame: { metersPerUnit: 100 } });
});
test('rejects malformed physical frames and uncontained source references', () => {
  const invalidFrame = descriptor(); invalidFrame.properties.frame.localToReferenceXyzw[3] = 2;
  assert.throws(() => parseImageLayerBankDescriptor(invalidFrame), /unit quaternion/);
  const escaped = descriptor(); escaped.properties.preparation.source = '../recipe.json';
  assert.throws(() => parseImageLayerBankDescriptor(escaped), /contained/);
});
test('a bank says whether its light surrounds what stands inside it', () => {
  assert.equal(parseImageLayerBankDescriptor(descriptor()).surrounds, false);
  assert.equal(parseImageLayerBankDescriptor({ ...descriptor(), properties: { ...descriptor().properties, surrounds: true } }).surrounds, true);
  assert.throws(() => parseImageLayerBankDescriptor({ ...descriptor(), properties: { ...descriptor().properties, surrounds: 'yes' } }), /src\/objects\/cloud\/object\.json properties\.surrounds is true or absent, not "yes"/u);
});
