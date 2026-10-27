import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PreparedVolumeImpostors } from './css-volume-types.js';
import { validateVolumeImpostors } from './volume-impostor-validation.js';

const bank: PreparedVolumeImpostors = { schema: 'cssearth-volume-impostors@1', radiusUnits: 1,
  fullBelowDiameterPixels: 128, volumeAboveDiameterPixels: 256,
  views: [
    { id: 'front', back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0], texturePath: 'front.png' },
    { id: 'back', back: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0], texturePath: 'back.png' },
    { id: 'right', back: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0], texturePath: 'right.png' },
    { id: 'left', back: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0], texturePath: 'left.png' },
    { id: 'up', back: [0, 1, 0], right: [-1, 0, 0], down: [0, 0, -1], texturePath: 'up.png' },
    { id: 'down', back: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1], texturePath: 'down.png' },
  ] };
test('prepared impostors require thresholds, declared textures and orthonormal camera bases', () => {
  const resources = new Set(bank.views.map(view => view.texturePath));
  assert.deepEqual(validateVolumeImpostors(bank, resources), bank);
  assert.throws(() => validateVolumeImpostors({ ...bank, volumeAboveDiameterPixels: 1 }, resources), /thresholds/);
  assert.throws(() => validateVolumeImpostors(bank, new Set()), /declared/);
  assert.throws(() => validateVolumeImpostors({ ...bank, views: [{ ...bank.views[0], right: [2, 0, 0] }, ...bank.views.slice(1)] }, resources), /orthonormal/);
});

test('physical distance handoff is optional, bounded and ordered',()=>{
 const resources=new Set(bank.views.map(v=>v.texturePath)),distanceFade={detailBelowUnits:20,impostorAboveUnits:35};
 assert.deepEqual(validateVolumeImpostors({...bank,distanceFade},resources).distanceFade,distanceFade);
 for(const invalid of[{detailBelowUnits:0,impostorAboveUnits:35},{detailBelowUnits:35,impostorAboveUnits:20},{detailBelowUnits:20,impostorAboveUnits:Infinity},{...distanceFade,extra:1}])assert.throws(()=>validateVolumeImpostors({...bank,distanceFade:invalid},resources));
});
