import { describe, expect, it } from 'vitest';
import { parseObjectDescriptor, prepareObject, readPreparedObject } from './index.js';
import type { JsonRecord, ObjectPreparation } from './index.js';

const descriptor = (id = 'example') => ({
  schema: 'cssearth-object@1', id, type: 'layered-body', properties: { radiusKm: 2, layers: ['surface'] },
  prepared: { format: 'example-artifact@1', url: '/prepared/example.json', sha256: 'a'.repeat(64) },
});

describe('object descriptor boundary', () => {
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
    { ...descriptor(), prepared: { ...descriptor().prepared, sha256: 'short' } },
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
