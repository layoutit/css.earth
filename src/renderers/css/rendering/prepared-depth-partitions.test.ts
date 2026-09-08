import { expect, test } from 'vitest';
import { createPreparedDepthPartitions } from './prepared-depth-partitions.js';
import { physicalProjectionFromCamera } from './physical-projection.js';

test('camera publication preserves carriers and changes prepared ordering only across a separating plane', () => {
  const writes: string[] = [];
  const nodes = Array.from({ length: 5 }, (_, i) => {
    const values: Record<string, string> = {};
    return { hidden: false, style: new Proxy(values, { set(target, key: string, value) {
      writes.push(`${i}:${key}:${value}`); target[key] = value; return true;
    } }) } as HTMLElement;
  });
  const publish = createPreparedDepthPartitions({ groups: [{ root: 1, scene: 2 }, { root: 3, scene: 4 }],
    order: { plane: [1,0,0,0], back: { group: 0 }, front: { group: 1 } } }, nodes, nodes[0]);
  const projection = (x: number) => physicalProjectionFromCamera([1,0,0,0,1,0,0,0,1], [-x,0,-100], 1,
    { focalPixels: 600, principalOffsetPixels: [41,-20] });
  nodes[0].style.transform = 'translate3d(41px,-20px,-100px) scale3d(1,1,1)';
  publish(projection(10));
  expect(nodes[2].style.transform).toBe(nodes[0].style.transform);
  expect(nodes[1].style.zIndex).toBe('0'); expect(nodes[3].style.zIndex).toBe('1');
  writes.length = 0;
  publish(projection(12)); expect(writes).toEqual([]);
  publish(projection(-10)); expect(writes).toEqual(['3:zIndex:0', '1:zIndex:1']);
  nodes[0].hidden = true; publish(projection(-10));
  expect(nodes[2].hidden).toBe(true); expect(nodes[4].hidden).toBe(true);
  nodes[0].hidden = false; publish(projection(10));
  expect(nodes[2].hidden).toBe(false);
});
