import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createPreparedDepthPartitions, sceneEye } from './prepared-depth-partitions.js';
import { physicalProjectionFromCamera } from '../prepared-data/physical-projection.js';

test('recovers the observer under rotation, translation and scene scale', () => {
  const p = physicalProjectionFromCamera([0, 0, 1, 0, 1, 0, -1, 0, 0], [-12, -8, 4], 2, { focalPixels: 600, principalOffsetPixels: [21, -7] });
  assert.deepEqual(sceneEye(p), [2, 4, 6]);
});

test('camera publication preserves carriers and changes prepared ordering only across a separating plane', () => {
  const writes: string[] = [];
  const nodes = Array.from({ length: 5 }, (_, i) => {
    const values = {transform: '', zIndex: ''};
    return { hidden: false, style: new Proxy(values, { set(target, key: string, value: string) {
      writes.push(`${i}:${key}:${value}`); Reflect.set(target, key, value); return true;
    } }) };
  });
  const publish = createPreparedDepthPartitions({ groups: [{ root: 1, scene: 2 }, { root: 3, scene: 4 }],
    order: { plane: [1,0,0,0], back: { group: 0 }, front: { group: 1 } } }, nodes, nodes[0]);
  const projection = (x: number) => physicalProjectionFromCamera([1,0,0,0,1,0,0,0,1], [-x,0,-100], 1,
    { focalPixels: 600, principalOffsetPixels: [41,-20] });
  nodes[0].style.transform = 'translate3d(41px,-20px,-100px) scale3d(1,1,1)';
  publish(projection(10));
  assert.equal(nodes[2].style.transform, nodes[0].style.transform);
  assert.equal(nodes[1].style.zIndex, '0'); assert.equal(nodes[3].style.zIndex, '1');
  writes.length = 0;
  publish(projection(12)); assert.deepEqual(writes, []);
  publish(projection(-10)); assert.deepEqual(writes, ['3:zIndex:0', '1:zIndex:1']);
  nodes[0].hidden = true; publish(projection(-10));
  assert.equal(nodes[2].hidden, true); assert.equal(nodes[4].hidden, true);
  nodes[0].hidden = false; publish(projection(10));
  assert.equal(nodes[2].hidden, false);
});

test('fixed prepared priorities are applied once while camera transforms keep publishing', () => {
  const nodes = Array.from({ length: 5 }, () => ({ style: {transform: '', zIndex: ''}, hidden: false }));
  const publish = createPreparedDepthPartitions({ groups: [{ root: 1, scene: 2 }, { root: 3, scene: 4 }],
    order: { sequence: [{ group: 1 }, { group: 0 }] } }, nodes, nodes[0]);
  const projection = physicalProjectionFromCamera([1,0,0,0,1,0,0,0,1], [0,0,-100], 1,
    { focalPixels: 600, principalOffsetPixels: [0,0] });
  nodes[0].style.transform = 'scale(1)'; publish(projection);
  assert.equal(nodes[1].style.zIndex, '1'); assert.equal(nodes[3].style.zIndex, '0');
  Object.defineProperty(nodes[1].style, 'zIndex', { set() { throw new Error('Repeated fixed priority write'); } });
  nodes[0].style.transform = 'scale(2)'; publish(projection);
  assert.equal(nodes[2].style.transform, 'scale(2)'); assert.equal(nodes[4].style.transform, 'scale(2)');
});
