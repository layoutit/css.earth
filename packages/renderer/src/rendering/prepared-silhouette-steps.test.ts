import { requireViewBindings, type PreparedTree, type CameraPlan } from '@cssearth/objects';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectPreparedSilhouetteStep } from './prepared-silhouette-steps.js';

const steps = { hysteresis: 0.1, levels: [{ minimumDiameter: 0, value: '0.03' }, { minimumDiameter: 16, value: '0.02' }, { minimumDiameter: 32, value: '0.01' }] };

test('a silhouette step follows the diameter with hysteresis and holds without a projection', () => {
  assert.equal(selectPreparedSilhouetteStep(steps, 20, undefined), 1);
  assert.equal(selectPreparedSilhouetteStep(steps, 40, 1), 2);
  assert.equal(selectPreparedSilhouetteStep(steps, 30, 2), 2);
  assert.equal(selectPreparedSilhouetteStep(steps, 28, 2), 1);
  assert.equal(selectPreparedSilhouetteStep(steps, null, 2), 2);
  assert.equal(selectPreparedSilhouetteStep(steps, null, undefined), undefined);
});

test('silhouette step bindings name a retained node, a custom property and increasing steps', () => {
  const tree = { nodes: [-1, 0, 1].map(parent => ({ tag: 'div', parent, className: null, style: '', properties: [], attributes: {} })),
    properties: [], camera: 0, scene: 1, stageClasses: [] } as PreparedTree;
  const camera = {} as CameraPlan;
  const binding = { kind: 'silhouette-step-property', target: 2, property: '--surface-seam-outset', ...steps };
  assert.doesNotThrow(() => requireViewBindings([binding], tree, camera));
  for (const invalid of [{ ...binding, property: 'opacity' }, { ...binding, target: 0 }, { ...binding, target: -1 }, { ...binding, hysteresis: 1 },
    { ...binding, levels: steps.levels.slice(1) }, { ...binding, levels: [steps.levels[0], steps.levels[2], steps.levels[1]] }]) {
    assert.throws(() => requireViewBindings([invalid], tree, camera));
  }
});
