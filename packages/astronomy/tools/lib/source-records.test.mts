import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseElements, parseVectors } from './horizons.mts';
import { objectValue, readElementRecord, readVectorFixture } from './generator-records.mts';
import { parseBodyEpochRecord, parseSceneManifest } from './ephemeris-records.mts';

describe('astronomy source decoding', () => {
  it('retains float64 Horizons components and rejects malformed numeric CSV cells', () => {
    const text = '$$SOE\n2461286.5, date,1.234567890123456,-2,3,4,5,6\n$$EOE';
    expect(parseVectors(text)[0].position).toEqual([1.234567890123456, -2, 3]);
    expect(() => parseVectors(text.replace(',-2,', ',bad,'))).toThrow(/non-finite/);
    expect(() => parseElements('$$SOE\n2461286.5,date,0.1,1,2,3,4,5,6,7,8,bad,10,11\n$$EOE')).toThrow(/non-finite/);
  });
  it('checks nested retained element and vector records without numeric coercion', () => {
    expect(() => readElementRecord({ query: 'source', elements: { epochJdTt: '2461286.5' } })).toThrow(/finite/);
    expect(() => readVectorFixture({ query: 'source', rows: [{ jd: 2461286.5, position: [1, 2], velocity: [3, 4, 5] }] })).toThrow(/three components/);
  });
  it('preserves uninterpreted provenance while checking versioned source structure', () => {
    const manifest: unknown = JSON.parse(readFileSync(new URL('../../source/scene-epoch/manifest.json', import.meta.url), 'utf8'));
    expect(parseSceneManifest(manifest)).toEqual(manifest);
    const malformed = { ...objectValue(manifest), records: {} };
    expect(() => parseSceneManifest(malformed)).toThrow(/records.*array/);
    const path = new URL('../../../../src/planets/romulus/source/validation/epoch-state.json', import.meta.url);
    const body: unknown = JSON.parse(readFileSync(path, 'utf8'));
    expect(parseBodyEpochRecord(body)).toEqual(body);
    expect(() => parseBodyEpochRecord({ ...objectValue(body), positionKm: [1, '2', 3] })).toThrow(/positionKm.*finite/);
  });
});
