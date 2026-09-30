import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import type { PreparedViewBinding } from './prepared-presentation.js';
import { createLeafBoxWriter, leafBoxStyles, type PreparedLeafBox } from './prepared-leaf-box-direct.js';

// Two of Venus's leaf-box records (packages/bake/src/presentation/leaf-box-records.ts), under the system node 0.
const matrix = 'matrix3d(7.503457,-0.739026,0,0,0.004556,0.046257,100.99439,-0.007833,0.028587,0.290248,-0.956524,0,-7.905404,2381.267936,-12169.276988,1)';
const boxes: PreparedLeafBox[] = [
  { node: 1, density: 0.003253, box: [64, 64], atlas: true, backgroundSize: [2016.96, 1489.454], backgroundPosition: [-14.5454, -1317.818], matrix, seam: [77.0239, 19.872] },
  { node: 2, density: 0.003231, box: [64, 64], atlas: true, backgroundSize: [2016.96, 1489.454], backgroundPosition: ['0', -1317.818], matrix },
];
const levels = [{ minimumDiameter: 0, value: '16' }, { minimumDiameter: 100, value: '362' }];
const bindings = [
  { kind: 'silhouette-step-property', target: 0, property: '--silhouette-step', hysteresis: .1, levels, groups: { '--silhouette-step-0': [1, 2] }, initial: '362', boxes },
  { kind: 'silhouette-step-property', target: 0, property: '--surface-seam-outset', hysteresis: .1, levels, initial: '0.00116133' },
] as unknown as PreparedViewBinding[];

test('a leaf box record gives the final values at a step and seam outset', () => {
  // Step 362 × 0.003253 exceeds 1: the full box. Step 100 gives a factor of 0.3253.
  expect(leafBoxStyles(boxes[0]!, 362, 0.00116133)).toEqual([
    ['backgroundPosition', '-14.5454px -1317.818px'], ['backgroundSize', '2016.96px 1489.454px'],
    ['transform', `${matrix} scale(1) translate(50%, 50%) scale(1.08945, 1.023078) translate(-50%, -50%)`],
    ['width', '64px'], ['height', '64px'],
  ]);
  expect(Object.fromEntries(leafBoxStyles(boxes[0]!, 100, 0))).toMatchObject({
    backgroundSize: '656.117088px 484.519386px', width: '20.8192px', height: '20.8192px',
    transform: `${matrix} scale(3.074085) translate(50%, 50%) scale(1, 1) translate(-50%, -50%)`,
  });
  // A component kept as written is not scaled; a leaf without seam coefficients has no seam term.
  expect(Object.fromEntries(leafBoxStyles(boxes[1]!, 100, 0.002))).toMatchObject({ backgroundPosition: '0 -425.786996px', transform: `${matrix} scale(3.095017)` });
});

test('a mounted leaf receives its values from the record and writes only what changes', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = [0, 1, 2].map(() => document.createElement('s'));
  const writes: [number, string][] = [];
  const writer = createLeafBoxWriter(bindings, nodes, (element, name, value) => { writes.push([nodes.indexOf(element), name]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value); });
  expect(nodes[1]!.style.getPropertyValue('width')).toBe('64px');
  expect(nodes[1]!.getAttribute('style')).not.toMatch(/var\(|calc\(|--/);
  writes.length = 0;
  writer.set(1, '--silhouette-step', '100');
  expect(writes).toEqual([[1, 'backgroundPosition'], [1, 'backgroundSize'], [1, 'transform'], [1, 'width'], [1, 'height']]);
  expect(writer.read(1, '--silhouette-step')).toBe('100');
  expect(writer.read(2, '--silhouette-step')).toBe('362');
  writes.length = 0;
  writer.set(1, '--silhouette-step', '100');
  expect(writes).toEqual([]);
  // The seam outset rewrites only transforms, and only on leaves it reaches.
  writer.set(0, '--surface-seam-outset', '0.002');
  expect(writes).toEqual([[1, 'transform']]);
  expect(writer.owns(0, '--surface-seam-outset')).toBe(true);
  expect(writer.owns(2, '--silhouette-step')).toBe(true);
});
