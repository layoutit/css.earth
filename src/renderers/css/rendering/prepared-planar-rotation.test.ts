import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { createPreparedPlanarRotationPublisher } from './prepared-planar-rotation.js';

test('native material rotation preserves the projected centre without browser globals', () => {
  const { document } = parseHTML('<html><body><s style="transform:matrix(2,0,0,3,10,-20)"></s></body></html>');
  const element = document.querySelector('s')!;
  const publish = createPreparedPlanarRotationPublisher({ element, width: 100, height: 60 });
  expect(publish(90)).toBe(true);
  // The centre stays at (110, 70); the upper-left corner rotates to (170, -80).
  expect(element.style.transform).toBe('matrix3d(0,3,0,0,-2,0,0,0,0,0,1,0,170,-80,0,1)');
  expect(publish(90)).toBe(false);
  expect(publish(0)).toBe(true);
  expect(element.style.transform).toBe('matrix3d(2,0,0,0,0,3,0,0,0,0,1,0,10,-20,0,1)');
  expect(document.querySelector('s')).toBe(element);
  expect(() => publish(NaN)).toThrow('finite');
});
