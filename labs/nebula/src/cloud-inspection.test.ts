import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudCompositeOpacity, createCloudInspection, parseCloudCatalogue, validateCloudBrightness } from './cloud-inspection.js';

const catalogue = { schema: 'cssearth-cloud-parts@1', id: 'example', referenceLeafIds: ['r'], parts: [
  { id: 'a', label: 'Structure 1', kind: 'extended', signalFraction: .4, defaultEnabled: true, leafIds: ['a1', 'a2'] },
  { id: 'b', label: 'Structure 2', kind: 'extended', signalFraction: .3, defaultEnabled: true, leafIds: ['b1'] },
  { id: 'd', label: 'Diffuse', kind: 'diffuse', signalFraction: .3, defaultEnabled: false, leafIds: ['d1'] },
] };
const leafIds = ['r', 'a1', 'a2', 'b1', 'd1'];
test('default uses exact reference; subsets select owned prepared leaves and empty means empty', () => {
  const cloud = createCloudInspection(parseCloudCatalogue(catalogue, 'example', leafIds));
  assert.deepEqual(leafIds.filter(id => cloud.includes(id)), ['r']);
  cloud.setSelection(['b']); assert.deepEqual(leafIds.filter(id => cloud.includes(id)), ['b1']);
  cloud.setSelection(['a', 'd']); assert.deepEqual(leafIds.filter(id => cloud.includes(id)), ['a1', 'a2', 'd1']);
  cloud.setSelection([]); assert.deepEqual(leafIds.filter(id => cloud.includes(id)), []);
  cloud.setSelection(['b', 'a']); assert.deepEqual(leafIds.filter(id => cloud.includes(id)), ['r']);
  assert.throws(() => cloud.setSelection(['missing'])); assert.throws(() => cloud.setSelection(['a', 'a']));
});
test('catalogue rejects ambiguous, missing, duplicated or unrelated contributions', () => {
  assert.throws(() => parseCloudCatalogue(catalogue, 'other', leafIds));
  assert.throws(() => parseCloudCatalogue(catalogue, 'example', [...leafIds, 'unowned']));
  for (const edit of [
    (c: typeof catalogue) => { c.parts[0]!.leafIds.push('r'); },
    (c: typeof catalogue) => { c.parts[0]!.signalFraction = .8; },
    (c: typeof catalogue) => { c.parts[0]!.id = 'reference'; },
  ]) { const copy = structuredClone(catalogue); edit(copy); assert.throws(() => parseCloudCatalogue(copy, 'example', leafIds)); }
});
test('brightness uses effective source-over contributions through axis handoffs', () => {
  const gains = { overall: .5, x: .2, y: .5, z: .8 };
  const banks = [{ axis: 'x' as const, opacity: 1, visible: true },
    { axis: 'y' as const, opacity: .5, visible: true }, { axis: 'z' as const, opacity: 1 / 3, visible: true }];
  assert.ok(Math.abs(cloudCompositeOpacity(banks, gains) - .25) < 1e-12);
  banks[2]!.visible = false;
  assert.equal(cloudCompositeOpacity(banks, gains), .175);
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.equal(cloudCompositeOpacity([{ axis, opacity: 1, visible: true }], gains), gains.overall * gains[axis]);
  }
  for (let step = 0; step <= 100; step++) {
    const w = step / 100;
    const value = cloudCompositeOpacity([{ axis: 'x', opacity: 1, visible: true }, { axis: 'z', opacity: w, visible: true }], gains);
    assert.ok(Math.abs(value - .5 * (.2 * (1 - w) + .8 * w)) < 1e-12);
  }
  assert.throws(() => validateCloudBrightness({ ...gains, overall: 1.1 }));
  assert.throws(() => validateCloudBrightness({ ...gains, x: NaN }));
});
