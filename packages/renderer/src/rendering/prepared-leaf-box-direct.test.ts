import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
  assert.deepEqual(leafBoxStyles(boxes[0]!, 362, 0.00116133), [
    // The background is a share of the box, the same at every step: 2016.96 / 64 and -14.5454 / (64 - 2016.96).
    ['backgroundPosition', '0.744787% 92.449002%'], ['backgroundSize', '3151.5% 2327.271875%'],
    ['transform', `${matrix} scale(1) translate(50%, 50%) scale(1.08945, 1.023078) translate(-50%, -50%)`],
    ['width', '64px'], ['height', '64px'],
  ]);
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 100, 0)), {
    backgroundSize: '3151.5% 2327.271875%', width: '20.8192px', height: '20.8192px',
    transform: `${matrix} scale(3.074085) translate(50%, 50%) scale(1, 1) translate(-50%, -50%)`,
  });
  // A component kept as written is not scaled; a leaf without seam coefficients has no seam term.
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[1]!, 100, 0.002)), { backgroundPosition: '0 92.449002%', transform: `${matrix} scale(3.095017)` });
});

test('a mounted leaf receives its values from the record and writes only what changes', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = [0, 1, 2].map(() => document.createElement('s'));
  const writes: [number, string][] = [];
  const writer = createLeafBoxWriter(bindings, nodes, (element, name, value) => { writes.push([nodes.indexOf(element), name]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value); });
  assert.equal(nodes[1]!.style.getPropertyValue('width'), '64px');
  assert.doesNotMatch(nodes[1]!.getAttribute('style'), /var\(|calc\(|--/);
  writes.length = 0;
  writer.set(1, '--silhouette-step', '100');
  // A step resizes the box; the background, a share of it, is not written again.
  assert.deepEqual(writes, [[1, 'transform'], [1, 'width'], [1, 'height']]);
  assert.equal(writer.read(1, '--silhouette-step'), '100');
  assert.equal(writer.read(2, '--silhouette-step'), '362');
  writes.length = 0;
  writer.set(1, '--silhouette-step', '100');
  assert.deepEqual(writes, []);
  // The seam outset rewrites only transforms, and only on leaves it reaches.
  writer.set(0, '--surface-seam-outset', '0.002');
  assert.deepEqual(writes, [[1, 'transform']]);
  assert.equal(writer.owns(0, '--surface-seam-outset'), true);
  assert.equal(writer.owns(2, '--silhouette-step'), true);
});

test('a seam outset change lands a slice of leaves at a time', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const seamed = Array.from({ length: 5 }, (_, index) => ({ ...boxes[0]!, node: index + 1 }));
  const records = [{ ...bindings[0]!, groups: { '--silhouette-step-0': [1, 2, 3, 4, 5] }, boxes: seamed }, bindings[1]!] as unknown as PreparedViewBinding[];
  const nodes = Array.from({ length: 6 }, () => document.createElement('s'));
  const written: number[] = [];
  const writer = createLeafBoxWriter(records, nodes, (element, name, value) => { written.push(nodes.indexOf(element)); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value); });
  written.length = 0;
  assert.equal(writer.drainOutset('0.002', 2), 2);
  assert.deepEqual(written, [1, 2]);
  assert.equal(writer.read(0, '--surface-seam-outset'), '0.002');
  // A new outset before the drain ends restarts it; each leaf still takes only what changed.
  assert.equal(writer.drainOutset('0.003', 2), 2);
  assert.equal(writer.drainOutset('0.003', 2), 2);
  assert.equal(writer.drainOutset('0.003', 2), 1);
  assert.equal(writer.drainOutset('0.003', 2), 0);
  assert.deepEqual(written, [1, 2, 1, 2, 3, 4, 5]);
  assert.equal(nodes[5]!.style.getPropertyValue('transform'), leafBoxStyles(seamed[4]!, 362, 0.003).find(([name]) => name === 'transform')![1]);
});
