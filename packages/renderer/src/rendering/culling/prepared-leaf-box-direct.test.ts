import { type PreparedViewBinding, type PreparedLeafBox } from '@cssearth/objects';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseHTML } from 'linkedom';

import { createExactKeeper, createLeafBoxWriter, leafBoxExact, leafBoxStyles } from './prepared-leaf-box-direct.js';

// Two of Venus's leaf-box records (packages/bake/src/presentation/records/leaf-box-records.ts), under the system node 0.
const matrix = 'matrix3d(7.503457,-0.739026,0,0,0.004556,0.046257,100.99439,-0.007833,0.028587,0.290248,-0.956524,0,-7.905404,2381.267936,-12169.276988,1)';
const boxes: PreparedLeafBox[] = [
  { node: 1, density: 0.003253, box: [64, 64], atlas: true, backgroundSize: [2016.96, 1489.454], backgroundPosition: [-14.5454, -1317.818], matrix, seam: [77.0239, 19.872] },
  { node: 2, density: 0.003231, box: [64, 64], atlas: true, backgroundSize: [2016.96, 1489.454], backgroundPosition: ['0', -1317.818], matrix },
];
const levels = [{ minimumDiameter: 0, value: '16' }, { minimumDiameter: 100, value: '362' }];
const bindings = [
  { kind: 'silhouette-step-property', target: 0, property: 'silhouette-step', hysteresis: .1, levels, groups: { 'silhouette-step-0': [1, 2] }, initial: '362', boxes },
  { kind: 'silhouette-step-property', target: 0, property: 'surface-seam-outset', hysteresis: .1, levels, initial: '0.00116133' },
] as unknown as PreparedViewBinding[];

test('a leaf box record gives the final values at a step and seam outset', () => {
  // Step 362 × 0.003253 exceeds 1: the full box. Step 100 gives a factor of 0.3253.
  assert.deepEqual(leafBoxStyles(boxes[0]!, 362, 0.00116133), [
    // The background is written in pixels, scaled as the box is.
    ['backgroundPosition', '-14.5454px -1317.818px'], ['backgroundSize', '2016.96px 1489.454px'],
    ['transform', `${matrix} scale(1) translate(50%, 50%) scale(1.08945, 1.023078) translate(-50%, -50%)`],
    ['width', '64px'], ['height', '64px'],
  ]);
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 100, 0)), {
    backgroundPosition: '-4.731619px -428.686195px', backgroundSize: '656.117088px 484.519386px', width: '20.8192px', height: '20.8192px',
    transform: `${matrix} scale(3.074085) translate(50%, 50%) scale(1, 1) translate(-50%, -50%)`,
  });
  // A component kept as written is not scaled; a leaf without seam coefficients has no seam term.
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[1]!, 100, 0.002)), { backgroundPosition: '0 -425.786996px', transform: `${matrix} scale(3.095017)` });
});

test('a mounted leaf receives its values from the record and writes only what changes', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = [0, 1, 2].map(() => document.createElement('s'));
  const writes: [number, string][] = [];
  const writer = createLeafBoxWriter(bindings, nodes, (element, name, value) => { writes.push([nodes.indexOf(element), name]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value); });
  assert.equal(nodes[1]!.style.getPropertyValue('width'), '64px');
  assert.doesNotMatch(nodes[1]!.getAttribute('style') ?? '', /var\(|calc\(|--/);
  writes.length = 0;
  writer.set(1, 'silhouette-step', '100');
  // A step resizes the box and its background with it, in pixels, never as a share of the box or a calc().
  assert.deepEqual(writes, [[1, 'backgroundPosition'], [1, 'backgroundSize'], [1, 'transform'], [1, 'width'], [1, 'height']]);
  assert.doesNotMatch(nodes[1]!.getAttribute('style') ?? '', /var\(|calc\(|--|\d%[; ]/);
  assert.equal(writer.read(1, 'silhouette-step'), '100');
  assert.equal(writer.read(2, 'silhouette-step'), '362');
  writes.length = 0;
  writer.set(1, 'silhouette-step', '100');
  assert.deepEqual(writes, []);
  // The seam outset rewrites only transforms, and only on leaves it reaches.
  writer.set(0, 'surface-seam-outset', '0.002');
  assert.deepEqual(writes, [[1, 'transform']]);
  assert.equal(writer.owns(0, 'surface-seam-outset'), true);
  assert.equal(writer.owns(2, 'silhouette-step'), true);
});

test('a seam outset change lands a slice of leaves at a time', () => {
  const { document } = parseHTML('<html><body></body></html>');
  const seamed = Array.from({ length: 5 }, (_, index) => ({ ...boxes[0]!, node: index + 1 }));
  const records = [{ ...bindings[0]!, groups: { 'silhouette-step-0': [1, 2, 3, 4, 5] }, boxes: seamed }, bindings[1]!] as unknown as PreparedViewBinding[];
  const nodes = Array.from({ length: 6 }, () => document.createElement('s'));
  const written: number[] = [];
  const writer = createLeafBoxWriter(records, nodes, (element, name, value) => { written.push(nodes.indexOf(element)); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value); });
  written.length = 0;
  assert.equal(writer.drainOutset('0.002', 2), 2);
  assert.deepEqual(written, [1, 2]);
  assert.equal(writer.read(0, 'surface-seam-outset'), '0.002');
  // A new outset before the drain ends restarts it; each leaf still takes only what changed.
  assert.equal(writer.drainOutset('0.003', 2), 2);
  assert.equal(writer.drainOutset('0.003', 2), 2);
  assert.equal(writer.drainOutset('0.003', 2), 1);
  assert.equal(writer.drainOutset('0.003', 2), 0);
  assert.deepEqual(written, [1, 2, 1, 2, 3, 4, 5]);
  assert.equal(nodes[5]!.style.getPropertyValue('transform'), leafBoxStyles(seamed[4]!, 362, 0.003).find(([name]) => name === 'transform')![1]);
});

test('a leaf showing a sized image takes its exact box and draws the image at its own size', () => {
  // Venus's background is 2,016.96 px wide at the full box. A page 2,080 texels wide is one device pixel a texel in
  // a 33 px box; one 4,160 wide in a 66 px box, a texel's rounding over the full 64 px.
  const small = leafBoxExact(boxes[0]!, [2080, 1536]), wide = leafBoxExact(boxes[0]!, [4160, 3072]);
  assert.deepEqual([small, wide], [{ factor: 33 / 64, tile: [1040, 768], kept: true }, { factor: 66 / 64, tile: [2080, 1536], kept: true }]);
  // An image whose entry states no size has no exact fit, nor has a leaf without a background in pixels, nor an image
  // capped on purpose (one twice as wide as the full box holds), nor a background that stretches its image: Uranus's
  // faces draw a 3,880 x 2,880 map in a 1,940 x 1,425 px background.
  assert.equal(leafBoxExact(boxes[0]!, undefined), undefined);
  assert.equal(leafBoxExact({ node: 3, density: 1, box: [64, 64], matrix }, [2080, 1536]), undefined);
  assert.equal(leafBoxExact(boxes[0]!, [8320, 6144]), undefined);
  assert.equal(leafBoxExact({ node: 3, density: 1, box: [43.96, 43.55], backgroundSize: [1940, 1425], matrix }, [3880, 2880]), undefined);
  // The exact box, the image at its own size, a device pixel a texel on both axes, and the transform scaled back.
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 362, 0, false, small)), {
    width: '33px', height: '33px', backgroundSize: '1040px 768px', backgroundPosition: '-7.500008px -679.500155px',
    transform: `${matrix} scale(1.939394) translate(50%, 50%) scale(1, 1) translate(-50%, -50%)` });
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 362, 0, false, wide)), { width: '66px', height: '66px', backgroundSize: '2080px 1536px' });
  // A leaf the view needs less of keeps its exact box while every leaf of the body could: a halved or a step-sized box
  // draws the image at another scale, and that draw resamples.
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 16, 0, false, wide)), { width: '66px', height: '66px', backgroundSize: '2080px 1536px' });
  // On a body of 2,000 such leaves, 8.2 million px² of full boxes, the exact layers would pass the bytes kept beyond
  // need: the leaf takes what its step asks for, its prepared background scaled with it, until the step needs the
  // whole image.
  const dear = leafBoxExact(boxes[0]!, [4160, 3072], 2000 * 64 * 64);
  assert.equal(dear?.kept, false);
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 100, 0, false, dear)), { width: '20.8192px', backgroundSize: '656.117088px 484.519386px' });
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(boxes[0]!, 362, 0, false, dear)), { width: '66px', backgroundSize: '2080px 1536px' });
  // The exact box is one texel per device pixel: on a phone of three, Io's level 4,160 texels wide takes 43.33 px of
  // its 128 px box (on the layout grid) where an iPad of two takes 65 px, the image a third of its size in CSS pixels.
  const io: PreparedLeafBox = { node: 4, density: 1, box: [128, 128], backgroundSize: [4096, 756.184], backgroundPosition: [-660.676, -408.616], matrix };
  const ioArea = 448 * 128 * 128;
  assert.deepEqual(leafBoxExact(io, [4160, 768], ioArea, 2), { factor: 65 / 128, tile: [2080, 384], kept: true });
  assert.deepEqual(leafBoxExact(io, [4160, 768], ioArea, 3), { factor: 43.328125 / 128, tile: [4160 / 3, 256], kept: true });
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(io, 362, 0, false, leafBoxExact(io, [4160, 768], ioArea, 3))), { width: '43.328125px', backgroundSize: '1386.666667px 256px' });
  // At its widest level the same faces would hold 121 MB of layers: a leaf the view needs less of does not keep the box.
  assert.equal(leafBoxExact(io, [8320, 1536], ioArea, 2)?.kept, false);
  // The bytes kept beyond need are counted leaf by leaf, over the leaves kept so. Saturn's ring plane is a 2,048 px
  // box beside 448 faces of 64 px: it draws its own image at the size its step needs and counts for nothing, so the 62
  // faces behind the body keep the exact box of a 4,160 px dataset where the 386 the view fills hold it by need.
  const face = (node: number): PreparedLeafBox => ({ node, density: 0.003089, box: [64, 64], backgroundSize: [2080, 1536], backgroundPosition: [0, 0], matrix });
  const ring: PreparedLeafBox = { node: 500, density: 0.002, box: [2048, 2048], backgroundSize: [2048, 2048], backgroundPosition: [0, 0], matrix };
  const keep = createExactKeeper(2);
  assert.equal(keep(ring, 512, [4096, 4096])?.factor, 1);
  for (let node = 0; node < 386; node++) assert.equal(leafBoxStyles(face(node), 512, 0, false, keep(face(node), 512, [4160, 3072])).find(([name]) => name === 'width')?.[1], '64px');
  for (let node = 386; node < 448; node++) assert.equal(leafBoxStyles(face(node), 16, 0, false, keep(face(node), 16, [4160, 3072])).find(([name]) => name === 'width')?.[1], '64px', `face ${node} keeps its exact box`);
  // Past the bytes kept beyond need, the next leaf takes what its step asks for: 2,100 such faces are 34 MB at this image.
  const many = createExactKeeper(2);
  const widths = Array.from({ length: 2100 }, (_, node) => leafBoxStyles(face(node), 16, 0, false, many(face(node), 16, [4160, 3072])).find(([name]) => name === 'width')?.[1]);
  assert.equal(widths[0], '64px');
  assert.equal(widths.at(-1), '3.163136px');
  assert.equal(widths.filter(width => width === '64px').length, Math.floor(32 * 2 ** 20 / (64 * 64 * 16)));
  // A screen whose ratio is no whole number of two or more keeps the bake's two texels a CSS pixel, and there a leaf
  // the view needs less of does not keep the box: it is not exact on that screen.
  assert.deepEqual(leafBoxExact(io, [4160, 768], ioArea, 2.625), { factor: 65 / 128, tile: [2080, 384], kept: false });
  assert.deepEqual(leafBoxExact(io, [4160, 768], ioArea, 1), { factor: 65 / 128, tile: [2080, 384], kept: false });
  // Titan's faces show 64.5 texels of their quarter-size map: a box half a device pixel wide, the image still at its own size.
  const titan: PreparedLeafBox = { node: 3, density: 1, box: [128, 128], backgroundSize: [4127.76, 762.048], backgroundPosition: [-32.2481, -495.3], matrix };
  assert.partialDeepStrictEqual(Object.fromEntries(leafBoxStyles(titan, 362, 0, false, leafBoxExact(titan, [2080, 384]))), { width: '32.25px', height: '32.25px', backgroundSize: '1040px 192px' });
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = [0, 1, 2].map(() => document.createElement('s'));
  const writes: [number, string][] = [];
  const writer = createLeafBoxWriter(bindings, nodes, (element, name, value) => { writes.push([nodes.indexOf(element), name]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value); });
  writes.length = 0;
  // An image lands on its own leaf: its box, its own size as the background, and the transform.
  assert.equal(writer.image(1, [2080, 1536]), 5);
  assert.deepEqual(writes, [[1, 'backgroundPosition'], [1, 'backgroundSize'], [1, 'transform'], [1, 'width'], [1, 'height']]);
  assert.equal(nodes[1]!.style.getPropertyValue('width'), '33px');
  assert.equal(nodes[2]!.style.getPropertyValue('width'), '64px');
  assert.equal(writer.image(1, [2080, 1536]), 0);
  // The leaf keeps that box at any step: a step writes nothing on it.
  assert.equal(writer.set(1, 'silhouette-step', '100'), 0);
  assert.equal(writer.set(1, 'silhouette-step', '16'), 0);
  // An image without a stated size leaves the box to the step.
  assert.equal(writer.image(1, undefined), 5);
  assert.equal(nodes[1]!.style.getPropertyValue('width'), '3.331072px');
  // A node without a leaf box has nothing to size.
  assert.equal(writer.image(0, [2080, 1536]), 0);
});
