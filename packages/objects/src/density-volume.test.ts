import { describe, expect, it } from 'vitest';
import { parseDensityVolumeObjectDescriptor } from './density-volume.js';

const volume = () => ({
  schema: 'cssearth-object@1', id: 'example-volume', type: 'density-volume',
  properties: {
    volume: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [8.2e20, -1.1e20, 3.4e19],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 8.269676e19,
      boundsUnits: { min: [-10, -10, -1.25], max: [10, 10, 1.25] } },
    preparation: { source: 'source/preparation/volume.json' },
  },
  prepared: { format: 'cssearth-density-volume@1', url: 'prepared/object.json' },
});

describe('density-volume object descriptor', () => {
  it('preserves a physical local frame and pinned source reference', () => {
    const parsed = parseDensityVolumeObjectDescriptor(volume());
    expect(parsed.volume.originM).toEqual([8.2e20, -1.1e20, 3.4e19]);
    expect(parsed.preparation.source).toBe('source/preparation/volume.json');
    expect(Object.isFrozen(parsed.volume.boundsUnits)).toBe(true);
  });

  it.each([
    ['wrong reusable type', (value: ReturnType<typeof volume>) => { value.type = 'layered-body'; }],
    ['stray source hash', (value: ReturnType<typeof volume>) => { (value.properties.preparation as Record<string, unknown>).sha256 = 'a'.repeat(64); }],
    ['absolute source path', (value: ReturnType<typeof volume>) => { value.properties.preparation.source = '/volume.json'; }],
    ['non-unit rotation', (value: ReturnType<typeof volume>) => { value.properties.volume.localToReferenceXyzw = [0, 0, 0, 2]; }],
    ['collapsed bounds', (value: ReturnType<typeof volume>) => { value.properties.volume.boundsUnits.max = [-10, 10, 1.25]; }],
    ['renderer field', (value: ReturnType<typeof volume>) => { (value.properties.volume as Record<string, unknown>).css = 'matrix3d()'; }],
  ])('rejects %s', (_name, mutate) => {
    const input = volume();
    mutate(input);
    expect(() => parseDensityVolumeObjectDescriptor(input)).toThrow();
  });
});
