import { expect, test } from 'vitest';
import { parseImageLayerBankDescriptor } from './image-layer-bank.js';

function descriptor() {
  return { schema: 'cssearth-object@1', id: 'cloud', type: 'image-layer-bank', properties: {
    frame: { referenceFrame: 'icrf', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
      metersPerUnit: 100, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
    preparation: { source: 'source/recipe.json' } } };
}
test('parses a renderer-independent spatial image model without assigning measured density', () => {
  expect(parseImageLayerBankDescriptor(descriptor())).toMatchObject({ type: 'image-layer-bank', frame: { metersPerUnit: 100 } });
});
test('rejects malformed physical frames and uncontained source references', () => {
  const invalidFrame = descriptor(); invalidFrame.properties.frame.localToReferenceXyzw[3] = 2;
  expect(() => parseImageLayerBankDescriptor(invalidFrame)).toThrow(/unit quaternion/);
  const escaped = descriptor(); escaped.properties.preparation.source = '../recipe.json';
  expect(() => parseImageLayerBankDescriptor(escaped)).toThrow(/contained/);
});
