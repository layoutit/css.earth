import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseElements, parseVectors } from './horizons.mts';
import { objectValue, readElementRecord, readVectorFixture, readHostedOrbitRecord, readStarRecord } from './generator-records.mts';
import { parseBodyEpochRecord, parseSceneManifest } from './ephemeris-records.mts';

describe('astronomy source decoding', () => {
  it('retains explicit Hipparcos identities and rejects invalid cross-identifications', () => {
    const source = JSON.parse(readFileSync(new URL('../../data/bodies/betelgeuse.json', import.meta.url), 'utf8')).star;
    expect(readStarRecord(source).hipparcosId).toBe(27989);
    for (const hipparcosId of [0, -1, 27989.5, '27989', NaN]) expect(() => readStarRecord({ ...source, hipparcosId })).toThrow();
    const { hipparcosId: _id, ...unmatched } = source;
    expect(readStarRecord(unmatched).hipparcosId).toBeUndefined();
  });
  it('retains sourced eccentric hosted orbits and refuses missing conventions or unbound geometry', () => {
    const circular = { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0,
      transitTimeBmjdTdb: 59000, ascendingNodePositionAngleDegrees: 0,
      sources: { period: 'fixture', shape: 'fixture', phase: 'fixture BMJD_TDB', orientation: 'display convention' } };
    expect(readHostedOrbitRecord(circular)).toEqual(circular);
    const eccentric = { ...circular, eccentricity: 0.3, argumentOfPeriapsisDegrees: 135, epochDefinition: 'inferior-conjunction',
      sources: { ...circular.sources, eccentricity: 'selected fit table, e', argumentOfPeriapsis: 'same fit, planet-centric omega' } };
    expect(readHostedOrbitRecord(eccentric)).toEqual(eccentric);
    for (const field of ['argumentOfPeriapsisDegrees', 'epochDefinition'] as const) {
      expect(() => readHostedOrbitRecord({ ...eccentric, [field]: undefined })).toThrow(/eccentric hosted orbit/);
    }
    expect(() => readHostedOrbitRecord({ ...eccentric, sources: circular.sources })).toThrow(/sources/);
    expect(() => readHostedOrbitRecord({ ...eccentric, epochDefinition: 'UTC-midpoint' })).toThrow(/epoch definition/);
    for (const eccentricity of [-0.1, 1, 2, NaN]) expect(() => readHostedOrbitRecord({ ...eccentric, eccentricity })).toThrow();
    expect(() => readHostedOrbitRecord({ ...eccentric, argumentOfPeriapsisDegrees: 360 })).toThrow(/Invalid hosted orbit: argumentOfPeriapsisDegrees 360 is outside 0 to 360/);
    expect(() => readHostedOrbitRecord({ ...eccentric, semiMajorAxisStellarRadii: 1.1 })).toThrow(/Invalid hosted orbit: periastron 1\.1 x \(1 - [0-9.]+\) stellar radii is inside the star/);
    expect(() => readHostedOrbitRecord({ ...eccentric, semiMajorAxisStellarRadii: 0.838 })).toThrow(/semiMajorAxisStellarRadii 0\.838 puts the orbit inside the star/);
  });
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
    const path = new URL('../../../../src/objects/romulus/source/validation/epoch-state.json', import.meta.url);
    const body: unknown = JSON.parse(readFileSync(path, 'utf8'));
    expect(parseBodyEpochRecord(body)).toEqual(body);
    expect(() => parseBodyEpochRecord({ ...objectValue(body), positionKm: [1, '2', 3] })).toThrow(/positionKm.*finite/);
  });
});
