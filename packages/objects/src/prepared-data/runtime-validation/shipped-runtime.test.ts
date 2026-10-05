import { test } from 'node:test';
import assert from 'node:assert/strict';

import { requireImageRecords } from './image-records.js';

const node = (parent: number, style = '', properties: number[] = []) => ({ parent, tag: 's', className: null, style, properties, attributes: {} });
const texture = (target: number, name: string) => ({ kind: 'texture' as const, target, name, resource: 'surface:a', quoted: true });
const runtime = (overrides: { nodes?: ReturnType<typeof node>[]; properties?: { name: string; value: string; custom: boolean }[];
  slots?: { target: number; name: string; leaves: number[] }[]; writes?: ReturnType<typeof texture>[] } = {}) => ({
  id: 'fixture',
  tree: { nodes: overrides.nodes ?? [node(-1), node(0), node(1)], properties: overrides.properties ?? [], camera: 0, scene: 1, stageClasses: [],
    textureBindings: overrides.slots ?? [{ target: 1, name: 'surface', leaves: [2] }] },
  variants: [{ when: {}, required: [], materials: [], writes: overrides.writes ?? [texture(1, 'surface')] }],
});

test('a shipped runtime names its images as records', () => {
  assert.doesNotThrow(() => requireImageRecords(runtime()));
  // A slot that lists no element, and an image its own target draws.
  assert.doesNotThrow(() => requireImageRecords(runtime({ slots: [{ target: 1, name: 'surface', leaves: [] }], writes: [texture(1, 'surface'), texture(2, 'backgroundImage')] })));
});

test('the working form is refused with the object and the place it names a custom property', () => {
  assert.throws(() => requireImageRecords(runtime({ nodes: [node(-1), node(0), node(1, 'width:4px;background-image:var(--fixture-surface-image);')] })),
    /fixture: prepared runtime node 2 reads its image from a custom property: width:4px;background-image:var\(--fixture-surface-image\);/u);
  assert.throws(() => requireImageRecords(runtime({ properties: [{ name: 'backgroundImage', value: 'var(--fixture-rings)', custom: false }] })),
    /fixture: prepared runtime property backgroundImage reads its image from a custom property: var\(--fixture-rings\)/u);
  assert.throws(() => requireImageRecords(runtime({ slots: [{ target: 1, name: '--fixture-surface-image', leaves: [2] }], writes: [texture(1, '--fixture-surface-image')] })),
    /fixture: prepared runtime texture slot --fixture-surface-image on node 1 names a custom property/u);
  assert.throws(() => requireImageRecords(runtime({ writes: [texture(1, '--fixture-poles-image')] })),
    /fixture: prepared runtime texture write --fixture-poles-image on node 1 names no texture slot/u);
});
