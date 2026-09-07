import { describe, expect, it } from 'vitest';
import { parsePreparedGalaxyCatalog } from './spatial.js';

function fixture() {
  return { schema: 'cssearth-galaxy-catalog@1', frame: { referenceFrame: 'sun-icrf', epochJdTt: 1 },
    sources: [{ id: 'release', url: 'https://example.org/catalog.csv', sha256: 'a'.repeat(64), bytes: 1, citation: 'Measured catalogue' }],
    objects: [{ id: 'nearby', name: 'Nearby galaxy', aliases: [], positionM: [0, 0, -100],
      skyPosition: { raDeg: 0, decDeg: -90, sourceRef: 'release' },
      distance: { valuePc: 10, sourceRef: 'release', method: 'resolved-stars' },
      membership: { group: 'local-volume', subgroup: 'field', basis: 'Published neighboring nonmember' }, status: 'confirmed' }],
    exclusions: [], selection: { description: 'Measured galaxies; membership retained independently.' } };
}

describe('prepared scientific catalogue boundary', () => {
  it('preserves the row bank and does not infer membership or physical size from proximity', () => {
    const input = fixture(), result = parsePreparedGalaxyCatalog(input);
    expect(result).toBe(input);
    expect(result.objects).toBe(input.objects);
    expect(result.objects[0]!.membership.group).toBe('local-volume');
    expect(result.objects[0]!.halfLightRadius).toBeUndefined();
    expect(result.objects[0]!.presentation).toBeUndefined();
  });
  it('rejects nonfinite physical coordinates, invalid sky domains and duplicate identities', () => {
    const invalidPosition = fixture(); invalidPosition.objects[0]!.positionM[1] = NaN;
    expect(() => parsePreparedGalaxyCatalog(invalidPosition)).toThrow(/finite/);
    const invalidSky = fixture(); invalidSky.objects[0]!.skyPosition.decDeg = 91;
    expect(() => parsePreparedGalaxyCatalog(invalidSky)).toThrow(/domain/);
    const duplicate = fixture(); duplicate.objects.push(duplicate.objects[0]!);
    expect(() => parsePreparedGalaxyCatalog(duplicate)).toThrow(/Duplicate galaxy/);
  });
  it('requires the evidence fields rather than silently accepting undocumented data', () => {
    const missingDistance = fixture(); missingDistance.objects[0]!.distance.sourceRef = '';
    expect(() => parsePreparedGalaxyCatalog(missingDistance)).toThrow(/distance reference/);
    const missingMembership = fixture(); missingMembership.objects[0]!.membership.basis = '';
    expect(() => parsePreparedGalaxyCatalog(missingMembership)).toThrow(/membership evidence/);
  });
});
