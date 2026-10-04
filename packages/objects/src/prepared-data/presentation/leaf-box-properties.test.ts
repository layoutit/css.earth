import assert from 'node:assert/strict';
import test from 'node:test';
import { LEAF_BOX_PROPERTY, LEAF_BOX_FACTOR, SURFACE_SEAM_OUTSET_PROPERTY } from '@cssearth/objects';

test('shared leaf-box CSS wire properties retain their serialized names', () => {
  assert.deepEqual([LEAF_BOX_PROPERTY, LEAF_BOX_FACTOR, SURFACE_SEAM_OUTSET_PROPERTY],
    ['--silhouette-step', '--leaf-box', '--surface-seam-outset']);
});
