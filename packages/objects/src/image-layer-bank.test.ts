import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { bankOverlays, parseImageLayerBankDescriptor } from './image-layer-bank.js';
import { parseObjectDescriptor } from './parse.js';

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
test('a bank names its datasets and what each draws over its layers, the first the default; without them it has one, optical, with nothing', () => {
  const withOverlays = (overlays: unknown) => ({ ...descriptor(), properties: { ...descriptor().properties, overlays } });
  assert.deepEqual(parseImageLayerBankDescriptor(descriptor()).overlays, { optical: [] });
  const parsed = parseImageLayerBankDescriptor(withOverlays({ optical: [], 'outer-ejecta': ['outer-ejecta', 'proper-motions'], model: ['model-wireframe'] }));
  assert.deepEqual(Object.keys(parsed.overlays), ['optical', 'outer-ejecta', 'model'], 'the datasets keep their order: the first is the default');
  assert.deepEqual(parsed.overlays['outer-ejecta'], ['outer-ejecta', 'proper-motions']);
  assert.ok(isDeepStrictEqual(Object.keys(parseImageLayerBankDescriptor(withOverlays({ model: [], optical: [] })).overlays), ['model', 'optical']), 'another order is kept as written');
  for (const overlays of [[], 'optical', null, {}, { Optical: [] }, { optical: 'outer-ejecta' }, { optical: ['Outer'] }, { optical: [3] }, { optical: ['a', 'a'] }])
    assert.throws(() => parseImageLayerBankDescriptor(withOverlays(overlays)), /src\/objects\/cloud\/object\.json properties\.overlays maps dataset ids to distinct bank ids/u, JSON.stringify(overlays));
  assert.throws(() => parseImageLayerBankDescriptor({ ...descriptor(), properties: { ...descriptor().properties, cloudPoints: ['outer-ejecta'] } }), /Unknown image-layer property: cloudPoints/u,
    'the overlays replaced cloudPoints: a descriptor that still names it is refused');
});

test('volume banks use the same contained dataset-overlay references; undeclared overlays draw nothing', () => {
  const volume = (overlays?: unknown) => parseObjectDescriptor({ ...descriptor(), type: 'volume-dataset-bank', properties: {
    ...descriptor().properties, ...(overlays === undefined ? {} : { overlays }) } });
  assert.deepEqual(bankOverlays(volume()), {});
  const source = { optical: ['dust', 'gas'], model: [] };
  const parsed = bankOverlays(volume(source));
  assert.deepEqual(parsed, source);
  assert.ok(Object.isFrozen(parsed) && Object.isFrozen(parsed.optical));
  source.optical.push('later');
  assert.deepEqual(parsed.optical, ['dust', 'gas'], 'the validated record owns its arrays');
  for (const overlays of [null, [], {}, { optical: ['../cloud'] }, { optical: ['cloud.bin'] }, { optical: ['a', 'a'] }])
    assert.throws(() => bankOverlays(volume(overlays)), /properties.overlays maps dataset ids to distinct bank ids/u);
});
