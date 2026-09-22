import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { Quaternion, Vector3 } from 'three';
import { getFacilityPose, inwardDirection, facilityPoses } from './poses.mts';
import { requireArray, requireRecord, requireString } from '../sources/source-values.mts';

const library = requireRecord(JSON.parse(await readFile(new URL('../../site/source/facilities/render-library.json', import.meta.url), 'utf8')));
const models = requireArray(library.entries).map(value => requireRecord(value)).filter(entry => requireRecord(entry.source).kind === 'model-render');

test('every rendered source model has exactly one reviewed, source-bound pose', () => {
  assert.deepEqual(Object.keys(facilityPoses).sort(), models.map(entry => requireString(entry.id)).sort());
  for (const entry of models) {
    const pose = getFacilityPose(requireString(entry.id));
    assert.ok(pose.facingFeature && pose.evidence.identification && new URL(pose.evidence.url).protocol === 'https:');
    assert.ok([...pose.modelQuaternion, ...pose.sourceAxis].every(Number.isFinite));
  }
});

test('saved model rotations aim down-left in the fixed camera without mirroring geometry', () => {
  const target = new Vector3(...inwardDirection).normalize();
  for (const pose of Object.values(facilityPoses)) {
    const q = new Quaternion(...pose.modelQuaternion);
    assert.ok(Math.abs(q.length() - 1) < 1e-8);
    const axis = new Vector3(...pose.sourceAxis).normalize().applyQuaternion(q);
    assert.ok(axis.distanceTo(target) < 1e-8, pose.facingFeature);
    assert.ok(axis.x < 0 && axis.y < 0 && axis.z > 0);
  }
});

test('an unknown facility has no pose', () => {
  assert.throws(() => getFacilityPose('unknown-facility'), /Unreviewed/);
});
