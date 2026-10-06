import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import { withStepNameRecords, withoutStepNameRecords } from './step-name-records.ts';

const working = () => ({ id: 'fixture', viewBindings: [
  { kind: 'silhouette-fit', target: 1, minimumRadius: 1, unitScale: 1 },
  { kind: 'silhouette-step-property', target: 2, property: '--silhouette-step', hysteresis: 0.2, levels: [],
    groups: { '--silhouette-step': [9], '--silhouette-step-0': [3, 4], '--silhouette-step-body-1': [5] },
    groupSizes: { '--silhouette-step-0': [100, 2] },
    placements: { body: { center: [0, 0, 0], radius: 1 }, writes: { '--silhouette-step-0': { center: [0, 0, 1], radius: 1, normal: [0, 0, 1], spread: 0.1 } } } },
  { kind: 'silhouette-step-property', target: 2, property: '--surface-seam-outset', hysteresis: 0.2, levels: [] },
] });

test('the silhouette steps ship under plain names, on their bindings and every key that names a block', () => {
  const records = withStepNameRecords(working());
  assert.equal(JSON.stringify(records).includes('--'), false);
  const [fit, steps, seam] = records.viewBindings as Record<string, unknown>[];
  assert.deepEqual(fit, working().viewBindings[0]);
  assert.equal(steps!.property, 'silhouette-step');
  assert.deepEqual(Object.keys(steps!.groups as object), ['silhouette-step', 'silhouette-step-0', 'silhouette-step-body-1']);
  assert.deepEqual(Object.keys(steps!.groupSizes as object), ['silhouette-step-0']);
  assert.deepEqual(Object.keys((steps!.placements as { writes: object }).writes), ['silhouette-step-0']);
  assert.equal(seam!.property, 'surface-seam-outset');
  assert.equal(withStepNameRecords(records), records, 'records are left as they are');
});

test('the plain names return to the custom properties the bindings measure, key for key', () => {
  assert.deepEqual(withoutStepNameRecords(withStepNameRecords(working())), working());
  assert.equal(JSON.stringify(withoutStepNameRecords(withStepNameRecords(working()))), JSON.stringify(working()));
  const untouched = working();
  assert.equal(withoutStepNameRecords(untouched), untouched, 'the working form is left as it is');
});
