import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedImageLayerBank } from './image-layer-bank-validation.js';
import { PREPARED_CSS_VOLUME_SCHEMA, PREPARED_IMAGE_LAYER_BANK_SCHEMA } from './volume-schemas.js';
import type { VolumeAxis } from './css-volume-types.js';

const valid = () => ({
  schema: PREPARED_IMAGE_LAYER_BANK_SCHEMA, id: 'image-bank',
  frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  banks: (['x', 'y', 'z'] as const).map((axis: VolumeAxis, index) => ({
    axis, normalUnits: [0, 1, 2].map(component => component === index ? 1 : 0), samplingStepUnits: 0.5,
    leaves: [{ id: `${axis}-0`, centerUnits: [0, 0, 0], texturePath: `slices/${axis}/00.png`, widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }],
  })),
  resources: ['x', 'y', 'z'].map(axis => ({ path: `slices/${axis}/00.png`, bytes: 2, width: 2, height: 2 })),
  provenance: {}, approximation: {},
});

test('decodes an image-layer bank into prepared volume leaves and view metadata', () => {
  const input = valid(), result = validatePreparedImageLayerBank(input);
  assert.equal(result.schema, PREPARED_CSS_VOLUME_SCHEMA);
  assert.equal(result.id, input.id);
  assert.deepEqual(result.stacks, input.banks.map(({ axis, leaves }) => ({ axis, leaves })));
  assert.deepEqual(result.bankViews, input.banks.map(({ axis, normalUnits, samplingStepUnits }) =>
    ({ axis, normalUnits, samplingStepUnits })));
  assert.deepEqual(result.resources, input.resources);
});

test('rejects an image-layer bank without a positive sampling interval', () => {
  const input = valid();
  input.banks[0]!.samplingStepUnits = 0;
  assert.throws(() => validatePreparedImageLayerBank(input), /prepared plane normals and sampling intervals/);
});
