import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { refuseStaleKeptBindings } from '../build/prepare/prepare-object-json.mts';

test('--keep-bindings refuses when the solved system transform moved', () => {
  // A body outside any solved lane (world-context focus, or a lane with nothing to solve) carries no system transform.
  assert.doesNotThrow(() => refuseStaleKeptBindings('sun', null));
  // solveSystemTransform's {from, to} is a no-op pair when the system node did not move (prepare-world-navigation.ts's
  // replaceSystemTransform short-circuits on solved.from === solved.to), regardless of whether the body has any
  // physical material track — this must hold for irregular shape-model bodies (e.g. Mimas) with no materials at all.
  assert.doesNotThrow(() => refuseStaleKeptBindings('mimas', { from: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', to: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' }));
  const moved = { from: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', to: 'matrix3d(0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1)' };
  assert.throws(() => refuseStaleKeptBindings('mimas', moved), /--keep-bindings refused/);
  assert.throws(() => refuseStaleKeptBindings('mimas', moved), /mimas/);
});

