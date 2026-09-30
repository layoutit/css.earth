import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import type { PreparedTree } from './prepared-presentation.js';
import { compileLeafBoxes, createLeafBoxWriter, leafBoxStyles } from './prepared-leaf-box-direct.js';

// Venus's prepared records, cut to a mesh with two leaf boxes: the system node carries the body's step and seam
// outset, each leaf its factor, lengths and transform as calc() over them (packages/bake/src/presentation/leaf-box.ts).
const matrix = 'matrix3d(7.503457,-0.739026,0,0,0.004556,0.046257,100.99439,-0.007833,0.028587,0.290248,-0.956524,0,-7.905404,2381.267936,-12169.276988,1)';
const leafProperties = (density: string, x: string) => [
  { name: 'backgroundPosition', value: `calc(${x}px * var(--leaf-box, 1)) calc(-1317.818px * var(--leaf-box, 1))`, custom: false },
  { name: 'backgroundSize', value: 'calc(2016.96px * var(--leaf-box, 1)) calc(1489.454px * var(--leaf-box, 1))', custom: false },
  { name: 'transform', value: `${matrix} scale(calc(1 / var(--leaf-box, 1))) translate(50%, 50%) scale(calc(1 + var(--surface-seam-outset, 0) * 77.0239), calc(1 + var(--surface-seam-outset, 0) * 19.872)) translate(-50%, -50%)`, custom: false },
  { name: '--polycss-atlas-width', value: 'calc(64px * var(--leaf-box, 1))', custom: true },
  { name: '--polycss-atlas-height', value: 'calc(64px * var(--leaf-box, 1))', custom: true },
  { name: 'pointerEvents', value: 'none', custom: false },
  { name: '--leaf-box', value: `min(1, var(--silhouette-step, 1e6) * ${density})`, custom: true },
];
const properties = [
  { name: '--surface-seam-outset', value: '0.00116133', custom: true }, { name: '--silhouette-step', value: '362', custom: true },
  ...leafProperties('0.003253', '-14.5454'), ...leafProperties('0.003231', '-76.606'),
];
const tree = {
  nodes: [
    { parent: -1, tag: 'div', className: 'polycss-mesh venus-system', style: '', properties: [0, 1], attributes: {} },
    { parent: 0, tag: 's', className: null, style: '--polycss-atlas-width:32px', properties: [2, 3, 4, 5, 6, 7, 8], attributes: {} },
    { parent: 0, tag: 's', className: null, style: '', properties: [9, 10, 11, 12, 13, 14, 15], attributes: {} },
  ], properties, camera: 0, scene: 0, stageClasses: [],
} as unknown as PreparedTree;

function mount() {
  const { document } = parseHTML('<html><body></body></html>');
  const nodes = tree.nodes.map(record => {
    const node = document.createElement(record.tag);
    node.setAttribute('style', record.style);
    for (const id of record.properties) node.style.setProperty(properties[id]!.name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), properties[id]!.value);
    return node;
  });
  const writes: [number, string, string][] = [];
  const writer = createLeafBoxWriter(tree, 'venus', nodes, (element, name, value) => {
    writes.push([nodes.indexOf(element), name, value]); element.style.setProperty(name.replace(/[A-Z]/g, l => `-${l.toLowerCase()}`), value);
  });
  return { nodes, writes, writer };
}

test('a leaf box evaluates its prepared calc() expressions to plain values', () => {
  const leaf = compileLeafBoxes(tree, 'venus').get(1)!;
  // Step 362 × 0.003253 exceeds 1: the full box. Step 100 gives a factor of 0.3253.
  expect(leafBoxStyles(leaf, 362, 0.00116133)).toEqual([
    ['backgroundPosition', '-14.5454px -1317.818px'], ['backgroundSize', '2016.96px 1489.454px'],
    ['transform', `${matrix} scale(1) translate(50%, 50%) scale(1.08945, 1.023078) translate(-50%, -50%)`],
    ['width', '64px'], ['height', '64px'],
  ]);
  expect(Object.fromEntries(leafBoxStyles(leaf, 100, 0))).toMatchObject({
    backgroundSize: '656.117088px 484.519386px', width: '20.8192px', height: '20.8192px',
    transform: `${matrix} scale(3.074085) translate(50%, 50%) scale(1, 1) translate(-50%, -50%)`,
  });
});

test('a mounted leaf receives final values, keeps no leaf-box variable and writes only what changes', () => {
  const { nodes, writes, writer } = mount();
  for (const leaf of [nodes[1]!, nodes[2]!]) {
    expect(leaf.style.getPropertyValue('width')).toBe('64px');
    for (const name of ['--leaf-box', '--polycss-atlas-width', '--polycss-atlas-height']) expect(leaf.style.getPropertyValue(name)).toBe('');
    expect(leaf.getAttribute('style')).not.toContain('var(');
  }
  writes.length = 0;
  // A block step written on one leaf is that leaf's own.
  writer.set(1, '--silhouette-step', '100');
  expect(writes.map(([node, name]) => [node, name])).toEqual([[1, 'backgroundPosition'], [1, 'backgroundSize'], [1, 'transform'], [1, 'width'], [1, 'height']]);
  expect(writer.read(1, '--silhouette-step')).toBe('100');
  writes.length = 0;
  // The body step reaches only leaves without their own; the same step again writes nothing.
  writer.set(0, '--silhouette-step', '100');
  expect(new Set(writes.map(([node]) => node))).toEqual(new Set([2]));
  writes.length = 0;
  writer.set(0, '--silhouette-step', '100');
  expect(writes).toEqual([]);
  // The seam outset changes only transforms, on every leaf that inherits it.
  writer.set(0, '--surface-seam-outset', '0.002');
  expect(writes.map(([node, name]) => [node, name])).toEqual([[1, 'transform'], [2, 'transform']]);
  expect(nodes[0]!.style.getPropertyValue('--surface-seam-outset')).toBe('0.00116133');
});

test('a value that reads a leaf-box variable in an unknown form is refused with its object, node and property', () => {
  const broken = { ...tree, properties: properties.map((property, id) => id === 4 ? { ...property, value: 'scale(var(--leaf-box, 1))' } : property) } as unknown as PreparedTree;
  expect(() => compileLeafBoxes(broken, 'venus')).toThrow(/venus: prepared node 1 transform/);
});
