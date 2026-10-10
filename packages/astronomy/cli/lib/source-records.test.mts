import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseElements, parseVectors } from './horizons.mts';
import { objectValue, readElementRecord, readVectorFixture, readHostedOrbitRecord, readStarRecord } from './generator-records.mts';
import { parseBodyEpochRecord, parseSceneManifest } from './ephemeris-records.mts';

describe('astronomy source decoding', () => {
  it('retains explicit Hipparcos identities and rejects invalid cross-identifications', () => {
    const source = JSON.parse(readFileSync(new URL('../../data/bodies/betelgeuse.json', import.meta.url), 'utf8')).star;
    assert.equal(readStarRecord(source).hipparcosId, 27989);
    for (const hipparcosId of [0, -1, 27989.5, '27989', NaN]) assert.throws(() => readStarRecord({ ...source, hipparcosId }));
    const { hipparcosId: _id, ...unmatched } = source;
    assert.equal(readStarRecord(unmatched).hipparcosId, undefined);
  });
  it('retains sourced eccentric hosted orbits and refuses missing conventions or unbound geometry', () => {
    const circular = { periodDays: 3, semiMajorAxisStellarRadii: 9, inclinationDegrees: 88, eccentricity: 0,
      transitTimeBmjdTdb: 59000, ascendingNodePositionAngleDegrees: 0,
      sources: { period: 'fixture', shape: 'fixture', phase: 'fixture BMJD_TDB', orientation: 'display convention' } };
    assert.deepEqual(readHostedOrbitRecord(circular), circular);
    const eccentric = { ...circular, eccentricity: 0.3, argumentOfPeriapsisDegrees: 135, epochDefinition: 'inferior-conjunction',
      sources: { ...circular.sources, eccentricity: 'selected fit table, e', argumentOfPeriapsis: 'same fit, planet-centric omega' } };
    assert.deepEqual(readHostedOrbitRecord(eccentric), eccentric);
    for (const field of ['argumentOfPeriapsisDegrees', 'epochDefinition'] as const) {
      assert.throws(() => readHostedOrbitRecord({ ...eccentric, [field]: undefined }), /eccentric hosted orbit/);
    }
    assert.throws(() => readHostedOrbitRecord({ ...eccentric, sources: circular.sources }), /sources/);
    assert.throws(() => readHostedOrbitRecord({ ...eccentric, epochDefinition: 'UTC-midpoint' }), /epoch definition/);
    for (const eccentricity of [-0.1, 1, 2, NaN]) assert.throws(() => readHostedOrbitRecord({ ...eccentric, eccentricity }));
    assert.throws(() => readHostedOrbitRecord({ ...eccentric, argumentOfPeriapsisDegrees: 360 }), /Invalid hosted orbit: argumentOfPeriapsisDegrees 360 is outside 0 to 360/);
    assert.throws(() => readHostedOrbitRecord({ ...eccentric, semiMajorAxisStellarRadii: 1.1 }), /Invalid hosted orbit: periastron 1\.1 x \(1 - [0-9.]+\) stellar radii is inside the star/);
    assert.throws(() => readHostedOrbitRecord({ ...eccentric, semiMajorAxisStellarRadii: 0.838 }), /semiMajorAxisStellarRadii 0\.838 puts the orbit inside the star/);
  });
  it('keeps an approximate placement only with the assumption it rests on', () => {
    const measured = { periodDays: 14.65, semiMajorAxisStellarRadii: 26.9, inclinationDegrees: 93.9, eccentricity: 0,
      transitTimeBmjdTdb: 55495, ascendingNodePositionAngleDegrees: 124,
      sources: { period: 'fixture', shape: 'fixture', phase: 'fixture BMJD_TDB', orientation: 'fixture' } };
    const approximate = { ...measured, placement: 'approximate', sources: { ...measured.sources, placement: 'The plane is a sibling planet\'s; this planet\'s own tilt is not measured.' } };
    assert.deepEqual(readHostedOrbitRecord(approximate), approximate);
    assert.equal(readHostedOrbitRecord(measured).placement, undefined);
    assert.throws(() => readHostedOrbitRecord({ ...measured, placement: 'approximate' }), /states its assumption in sources\.placement/);
    assert.throws(() => readHostedOrbitRecord(Object.assign({}, measured, { sources: approximate.sources })), /states its assumption in sources\.placement/);
    assert.throws(() => readHostedOrbitRecord({ ...approximate, placement: 'illustrative' }), /placement is approximate or absent/);
  });
  it('retains float64 Horizons components and rejects malformed numeric CSV cells', () => {
    const text = '$$SOE\n2461286.5, date,1.234567890123456,-2,3,4,5,6\n$$EOE';
    assert.deepEqual(parseVectors(text)[0].position, [1.234567890123456, -2, 3]);
    assert.throws(() => parseVectors(text.replace(',-2,', ',bad,')), /non-finite/);
    assert.throws(() => parseElements('$$SOE\n2461286.5,date,0.1,1,2,3,4,5,6,7,8,bad,10,11\n$$EOE'), /non-finite/);
  });
  it('checks nested retained element and vector records without numeric coercion', () => {
    assert.throws(() => readElementRecord({ query: 'source', elements: { epochJdTt: '2461286.5' } }), /finite/);
    assert.throws(() => readVectorFixture({ query: 'source', rows: [{ jd: 2461286.5, position: [1, 2], velocity: [3, 4, 5] }] }), /three components/);
  });
  it('preserves uninterpreted provenance while checking versioned source structure', () => {
    const manifest: unknown = JSON.parse(readFileSync(new URL('../../source/scene-epoch/manifest.json', import.meta.url), 'utf8'));
    assert.deepEqual(parseSceneManifest(manifest), manifest);
    const malformed = { ...objectValue(manifest), records: {} };
    assert.throws(() => parseSceneManifest(malformed), /records.*array/);
    const path = new URL('../../../../src/objects/romulus/source/validation/epoch-state.json', import.meta.url);
    const body: unknown = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(parseBodyEpochRecord(body), body);
    assert.throws(() => parseBodyEpochRecord({ ...objectValue(body), positionKm: [1, '2', 3] }), /positionKm.*finite/);
  });
});
