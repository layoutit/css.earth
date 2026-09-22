import { describe, expect, it } from 'vitest';
import { parseAuthoredObjectDescriptor, parseAuthoredRecipe, parseObjectDescriptor, prepareObject, readPreparedObject } from './index.js';
import type { JsonRecord, ObjectPreparation } from './index.js';

const descriptor = (id = 'example') => ({
  schema: 'cssearth-object@1', id, type: 'layered-body', properties: { radiusKm: 2, layers: ['surface'] },
  prepared: { format: 'example-artifact@1', url: '/prepared/example.json' },
});

const hash = (letter: string) => letter.repeat(64);
const recipe = () => ({
  schema: 'cssearth-authored-object@1',
  sources: [
    { id: 'raster', path: 'source/preparation/raster.json' },
    { id: 'material', path: 'source/preparation/material.json' },
    { id: 'frames', path: 'source/preparation/frames.json' },
    { id: 'layers', path: 'source/preparation/layers.json' },
    { id: 'world', path: 'source/presentation/world.json' },
  ],
  shape: { kind: 'ellipsoid', radiusKm: 6051.8, polarRadiusKm: 6051.8 },
  frameBanks: [{ id: 'lighting', source: 'frames', frames: 128, rows: 32, residentRows: 3 }],
  materials: [{ id: 'surface-lit', source: 'material', model: 'lit', frameBank: 'lighting' }],
  surfaces: [{ id: 'body', source: 'raster', projection: 'equirectangular', lenses: [{ id: 'normal', source: 'raster', material: 'surface-lit' }] }],
  cutaway: { source: 'layers', surface: 'body', lens: 'normal' },
  atmosphere: { source: 'layers', frameBank: 'lighting' }, rings: { source: 'layers' }, emission: { source: 'layers' },
  motion: [{ id: 'spin', source: 'layers', target: 'body', durationMs: 89000 }, { id: 'ring-drift', source: 'layers', target: 'rings', durationMs: 42000 }],
  destinations: { source: 'world', maxEntries: 34135 },
  worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1, 2, 3], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 1, 0], metersPerUnit: 24402.58, bodyRadiusM: 6051800 },
});

describe('object descriptor boundary', () => {
  it('parses a composed authored recipe with source-pinned capabilities', () => {
    const parsed = parseAuthoredRecipe(recipe());
    expect(parsed.surfaces[0]?.lenses[0]?.material).toBe('surface-lit');
    expect(parsed.frameBanks?.[0]).toMatchObject({ frames: 128, rows: 32, residentRows: 3 });
    expect(parsed.destinations?.maxEntries).toBe(34135);
    const object = parseAuthoredObjectDescriptor({ ...descriptor(), properties: { recipe: recipe() } });
    expect(object.recipe.worldFrame?.referenceFrame).toBe('sun-icrf');
  });

  it.each([
    ['missing source', (value: ReturnType<typeof recipe>) => { value.surfaces[0]!.source = 'missing'; }],
    ['unsafe source path', (value: ReturnType<typeof recipe>) => { value.sources[0]!.path = '../raster.json'; }],
    ['invalid frame budget', (value: ReturnType<typeof recipe>) => { value.frameBanks[0]!.residentRows = 33; }],
    ['unknown layer motion', (value: ReturnType<typeof recipe>) => { value.motion[1]!.target = 'atmosphere'; Reflect.set(value, 'atmosphere', undefined); }],
  ])('rejects %s rather than passing malformed capabilities to a baker', (_name, mutate) => {
    const value = recipe();
    mutate(value);
    expect(() => parseAuthoredRecipe(value)).toThrow();
  });

  it('accepts a triaxial surface without lenses and rejects inverted or zero axes', () => {
    const source = { schema: 'cssearth-authored-object@1', sources: recipe().sources,
      surfaces: [{ id: 'body', source: 'raster', projection: 'equirectangular', lenses: [] }] };
    const shape = { kind: 'ellipsoid', radiusKm: 1161, secondaryRadiusKm: 852, polarRadiusKm: 513 };
    const parsed = parseAuthoredRecipe({ ...source, shape });
    expect(parsed.shape).toEqual(shape);
    expect(parsed.surfaces[0]!.lenses).toEqual([]);
    for (const secondaryRadiusKm of [0, 500, 1200]) {
      expect(() => parseAuthoredRecipe({ ...source, shape: { ...shape, secondaryRadiusKm } })).toThrow();
    }
  });

  it('requires a typed recipe at the authored object boundary', () => {
    expect(() => parseAuthoredObjectDescriptor(descriptor())).toThrow(/properties.recipe/);
  });

  it('parses JSON into an immutable owned record', () => {
    const source = descriptor();
    const parsed = parseObjectDescriptor(JSON.stringify(source));
    expect(parsed).toEqual(source);
    expect(Object.isFrozen(parsed.properties.layers)).toBe(true);
    source.properties.layers.push('atmosphere');
    expect(parsed.properties.layers).toEqual(['surface']);
  });

  it('keeps configuration independent of individual objects and renderer implementations', async () => {
    const parse = (properties: JsonRecord) => {
      if (typeof properties.radiusKm !== 'number') throw new TypeError('radiusKm');
      return properties.radiusKm;
    };
    const preparation: ObjectPreparation<number, number, { multiplier: number }> = {
      type: 'layered-body', format: 'example-artifact@1', parse,
      async bake(radiusKm, context) { return radiusKm * context.multiplier; },
    };
    const first = await prepareObject(parseObjectDescriptor(descriptor('first')), preparation, { multiplier: 3 });
    const second = await prepareObject(parseObjectDescriptor(descriptor('second')), preparation, { multiplier: 3 });
    expect(first.data).toBe(6);
    expect(second).toEqual({ ...first, id: 'second' });
  });

  it.each([
    '{broken',
    { ...descriptor(), schema: 'cssearth-object@99' },
    { ...descriptor(), id: '../escape' },
    { ...descriptor(), type: '' },
    { ...descriptor(), properties: null },
    { ...descriptor(), properties: { radiusKm: Infinity } },
    { ...descriptor(), properties: { run: () => {} } },
    { ...descriptor(), properties: { sparse: Array(1) } },
    { ...descriptor(), properties: new Date() },
    { ...descriptor(), prepared: { ...descriptor().prepared, sha256: 'a'.repeat(64) } },
    { ...descriptor(), prepared: { ...descriptor().prepared, url: ' ' } },
    { ...descriptor(), unexpected: true },
  ])('rejects malformed or unsupported descriptors %#', input => {
    expect(() => parseObjectDescriptor(input)).toThrow();
  });

  it('rejects cyclic and unsafe property records', () => {
    const cyclic: { child?: unknown } = {};
    cyclic.child = cyclic;
    expect(() => parseObjectDescriptor({ ...descriptor(), properties: cyclic })).toThrow(/cycle/);
    expect(() => parseObjectDescriptor('{"schema":"cssearth-object@1","id":"example","type":"layered-body","properties":{"__proto__":{}}}')).toThrow(/data field/);
  });

  it('allows additional layers as data without changing the parser or preparation dispatcher', () => {
    const parsed = parseObjectDescriptor({ ...descriptor(), properties: {
      radiusKm: 3, layers: [{ type: 'surface', source: 'surface-map' }, { type: 'paged-detail', levels: [1, 2] }],
    } });
    expect(parsed.properties.layers).toHaveLength(2);
  });

  it('rejects a mismatched preparation before running its work', async () => {
    let called = false;
    await expect(prepareObject(parseObjectDescriptor(descriptor()), {
      type: 'other-type', format: 'example-artifact@1', parse: value => value,
      bake() { called = true; return null; },
    }, null)).rejects.toThrow(/No other-type preparation/);
    expect(called).toBe(false);
  });

  it('validates identity and format before handing prepared data to the injected decoder', () => {
    const input = parseObjectDescriptor(descriptor());
    const prepared = { schema: 'cssearth-prepared-object@1', id: input.id, type: input.type, format: input.prepared!.format, data: 5 };
    let calls = 0;
    const decode = (data: unknown) => { calls++; if (typeof data !== 'number') throw new TypeError('payload'); return data; };
    for (const invalid of [{ ...prepared, id: 'different' }, { ...prepared, format: 'unknown@1' }, { ...prepared, type: 'unknown' }]) {
      expect(() => readPreparedObject(invalid, input, decode)).toThrow(/does not match/);
    }
    expect(calls).toBe(0);
    expect(readPreparedObject(prepared, input, decode).data).toBe(5);
    expect(() => readPreparedObject({ ...prepared, data: 'wrong' }, input, decode)).toThrow(/payload/);
  });
});
