import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createRenderElementBudget, maximumRenderSlabs, readRenderElementBudget, renderElementCount, type RenderElementProfile } from './render-element-budget.ts';

const profile: RenderElementProfile = { schema: 'cssearth-render-element-profile@1', id: 'test-retained-renderer@1',
  maximumElements: 500, elementsPerSlab: 3, elementsPerStar: 1, reservedElements: 47 };

test('all retained stars, optical copies and wrappers consume the same element budget', () => {
  assert.equal(maximumRenderSlabs(profile, 0), 151);
  assert.equal(maximumRenderSlabs(profile, 3), 150);
  assert.equal(createRenderElementBudget(profile, 0, 151).totalElements, 500);
  assert.equal(createRenderElementBudget(profile, 3, 150).totalElements, 500);
  assert.throws(() => createRenderElementBudget(profile, 1, 151), /501 retained elements/);
  assert.throws(() => createRenderElementBudget(profile, 0, 152), /503 retained elements/);
  assert.throws(() => maximumRenderSlabs(profile, 445), /no complete XYZ volume/);
  assert.equal(renderElementCount(profile, 0, 459), 1424, 'Historical over-budget cost remains reportable.');
});

test('a saved budget rejects changed geometry, hidden-point omissions and forged counters', () => {
  const saved = createRenderElementBudget(profile, 3, 150);
  assert.deepEqual(readRenderElementBudget(saved, 3, 150, profile), saved);
  assert.deepEqual(readRenderElementBudget(saved, 0, 150, profile), saved, 'A material component may reserve the final shared stars.');
  assert.throws(() => readRenderElementBudget(saved, 4, 150, profile), /star reservation/);
  assert.throws(() => readRenderElementBudget(saved, 3, 151, profile), /retained elements/);
  assert.throws(() => readRenderElementBudget({ ...saved, totalElements: 499 }, 3, 150, profile), /differs/);
  assert.throws(() => readRenderElementBudget(saved, 3, 150, { ...profile, elementsPerSlab: 4 }), /host renderer/);
  assert.throws(() => maximumRenderSlabs(profile, -1), /nonnegative/);
});
