import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseDensityVolumeObjectDescriptor } from './density-volume.js';

const volume = () => ({
  schema: 'cssearth-object@2', id: 'example-volume', type: 'density-volume',
  properties: {
    volume: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [8.2e20, -1.1e20, 3.4e19],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 8.269676e19,
      boundsUnits: { min: [-10, -10, -1.25], max: [10, 10, 1.25] } },
    preparation: { source: 'source/preparation/volume.json' },
  },
  prepared: { format: 'cssearth-density-volume@1', url: 'prepared/object.json' },
});

describe('density-volume object descriptor', () => {
  it('preserves a physical local frame and its source reference', () => {
    const parsed = parseDensityVolumeObjectDescriptor(volume());
    assert.deepEqual(parsed.volume.originM, [8.2e20, -1.1e20, 3.4e19]);
    assert.equal(parsed.preparation.source, 'source/preparation/volume.json');
    assert.equal(Object.isFrozen(parsed.volume.boundsUnits), true);
  });

  for (const [_name, mutate] of [
    ['wrong reusable type', (value: ReturnType<typeof volume>) => { value.type = 'layered-body'; }],
    ['stray source hash', (value: ReturnType<typeof volume>) => { (value.properties.preparation as Record<string, unknown>).sha256 = 'a'.repeat(64); }],
    ['absolute source path', (value: ReturnType<typeof volume>) => { value.properties.preparation.source = '/volume.json'; }],
    ['non-unit rotation', (value: ReturnType<typeof volume>) => { value.properties.volume.localToReferenceXyzw = [0, 0, 0, 2]; }],
    ['collapsed bounds', (value: ReturnType<typeof volume>) => { value.properties.volume.boundsUnits.max = [-10, 10, 1.25]; }],
    ['renderer field', (value: ReturnType<typeof volume>) => { (value.properties.volume as Record<string, unknown>).css = 'matrix3d()'; }],
  ]) it(`rejects ${_name}`, () => {
    const input = volume();
    mutate(input);
    assert.throws(() => parseDensityVolumeObjectDescriptor(input));
  });
});
