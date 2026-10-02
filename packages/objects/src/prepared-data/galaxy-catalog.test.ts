import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parsePreparedGalaxyCatalog } from './galaxy-catalog.js';

function fixture() {
  return { schema: 'cssearth-galaxy-catalog@1', frame: { referenceFrame: 'sun-icrf', epochJdTt: 1 },
    sources: [{ id: 'release', url: 'https://example.org/catalog.csv', bytes: 1, citation: 'Measured catalogue' }],
    objects: [{ id: 'nearby', name: 'Nearby galaxy', aliases: [], positionM: [0, 0, -3.085677581491367e17],
      skyPosition: { raDeg: 0, decDeg: -90, sourceRef: 'release' },
      distance: { valuePc: 10, sourceRef: 'release', method: 'resolved-stars' },
      membership: { group: 'local-volume', subgroup: 'field', basis: 'Published neighboring nonmember' }, status: 'confirmed' }],
    exclusions: [], selection: { description: 'Measured galaxies; membership retained independently.' } };
}

describe('prepared scientific catalogue boundary', () => {
  it('preserves the row bank and does not infer membership or physical size from proximity', () => {
    const input = fixture(), result = parsePreparedGalaxyCatalog(input);
    assert.equal(result, input);
    assert.equal(result.objects, input.objects);
    assert.equal(result.objects[0]!.membership.group, 'local-volume');
    assert.equal(result.objects[0]!.halfLightRadius, undefined);
    assert.equal(result.objects[0]!.presentation, undefined);
  });
  it('rejects nonfinite physical coordinates, invalid sky domains and duplicate identities', () => {
    const invalidPosition = fixture(); invalidPosition.objects[0]!.positionM[1] = NaN;
    assert.throws(() => parsePreparedGalaxyCatalog(invalidPosition), /finite/);
    const invalidSky = fixture(); invalidSky.objects[0]!.skyPosition.decDeg = 91;
    assert.throws(() => parsePreparedGalaxyCatalog(invalidSky), /domain/);
    const duplicate = fixture(); duplicate.objects.push(duplicate.objects[0]!);
    assert.throws(() => parsePreparedGalaxyCatalog(duplicate), /Duplicate galaxy/);
  });
  it('requires the evidence fields rather than silently accepting undocumented data', () => {
    const missingDistance = fixture(); missingDistance.objects[0]!.distance.sourceRef = '';
    assert.throws(() => parsePreparedGalaxyCatalog(missingDistance), /distance reference/);
    const missingMembership = fixture(); missingMembership.objects[0]!.membership.basis = '';
    assert.throws(() => parsePreparedGalaxyCatalog(missingMembership), /membership evidence/);
  });
});


it('rejects contradictory derived positions and unsupported frames', () => {
  for (const mutate of [(v: ReturnType<typeof fixture>) => { v.objects[0]!.positionM = [0, 0, 0]; },
    (v: ReturnType<typeof fixture>) => { v.objects[0]!.distance.valuePc *= 2; },
    (v: ReturnType<typeof fixture>) => { v.frame.referenceFrame = 'unknown'; }]) {
    const value = fixture(); mutate(value); assert.throws(() => parsePreparedGalaxyCatalog(value));
  }
});

it('retains unpositioned physical hosts and rejects dangling, duplicate and cyclic hosts', () => {
  const base = fixture(), child = { ...base.objects[0]!, hostId: 'host' };
  const host = { id: 'host', name: 'Physical host', sourceRef: 'release', reason: 'Observer lies inside this host.' };
  const valid = { ...base, objects: [child], unpositionedHosts: [host] };
  assert.deepEqual(parsePreparedGalaxyCatalog(valid).unpositionedHosts, [host]);
  assert.throws(() => parsePreparedGalaxyCatalog({ ...valid, unpositionedHosts: [] }), /Unknown physical host/);
  assert.throws(() => parsePreparedGalaxyCatalog({ ...valid, objects: [{ ...child, hostId: child.id }] }), /Cyclic/);
  assert.throws(() => parsePreparedGalaxyCatalog({ ...valid, unpositionedHosts: [{ ...host, hostId: child.id }] }), /Cyclic/);
  assert.throws(() => parsePreparedGalaxyCatalog({ ...valid, unpositionedHosts: [host, host] }), /Duplicate/);
});
