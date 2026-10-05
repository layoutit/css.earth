import { test } from 'node:test';
import assert from 'node:assert/strict';

import { requireShippedRuntime } from './shipped-runtime.js';

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
  assert.doesNotThrow(() => requireShippedRuntime(runtime()));
  // A slot that lists no element, and an image its own target draws.
  assert.doesNotThrow(() => requireShippedRuntime(runtime({ slots: [{ target: 1, name: 'surface', leaves: [] }], writes: [texture(1, 'surface'), texture(2, 'backgroundImage')] })));
});

test('the working form is refused with the object and the place it names a custom property', () => {
  assert.throws(() => requireShippedRuntime(runtime({ nodes: [node(-1), node(0), node(1, 'width:4px;background-image:var(--fixture-surface-image);')] })),
    /fixture: prepared runtime node 2 reads its image from a custom property: width:4px;background-image:var\(--fixture-surface-image\);/u);
  assert.throws(() => requireShippedRuntime(runtime({ properties: [{ name: 'backgroundImage', value: 'var(--fixture-rings)', custom: false }] })),
    /fixture: prepared runtime property backgroundImage reads its image from a custom property: var\(--fixture-rings\)/u);
  assert.throws(() => requireShippedRuntime(runtime({ slots: [{ target: 1, name: '--fixture-surface-image', leaves: [2] }], writes: [texture(1, '--fixture-surface-image')] })),
    /fixture: prepared runtime texture slot --fixture-surface-image on node 1 names a custom property/u);
  assert.throws(() => requireShippedRuntime(runtime({ properties: [{ name: '--fixture-camera-zoom', value: '1', custom: true }] })),
    /fixture: prepared runtime tree sets the custom property --fixture-camera-zoom: 1/u);
  assert.throws(() => requireShippedRuntime(runtime({ writes: [texture(1, '--fixture-poles-image')] })),
    /fixture: prepared runtime texture write --fixture-poles-image on node 1 names no texture slot/u);
});

test('no write, binding, key or style of a shipped runtime names or reads a custom property', () => {
  const shipped = { ...runtime(), viewBindings: [{ kind: 'silhouette-step-property', target: 1, property: 'silhouette-step', groups: { 'silhouette-step-0': [2] } },
    { kind: 'view-property', target: 2, property: 'opacity', source: 'billboard-opacity', precision: 6 }], materials: [{ id: 'lighting', target: 2, rotation: { kind: 'angle' } }] };
  assert.doesNotThrow(() => requireShippedRuntime(shipped as never));
  const style = { kind: 'style' as const, target: 1, name: '--fixture-billboard-color', value: '#484848' };
  assert.throws(() => requireShippedRuntime({ ...runtime(), variants: [{ when: {}, required: [], materials: [], writes: [style] }] }),
    /fixture: prepared runtime style write --fixture-billboard-color on node 1 names a custom property/u);
  assert.throws(() => requireShippedRuntime(runtime({ nodes: [node(-1), node(0), node(1, 'height:4px;display:var(--fixture-shape-display,none)')] })),
    /fixture: prepared runtime node 2 sets or reads a custom property: height:4px;display:var\(--fixture-shape-display,none\)/u);
  assert.throws(() => requireShippedRuntime(runtime({ properties: [{ name: 'width', value: 'calc(4px * var(--leaf-box, 1))', custom: false }] })),
    /fixture: prepared runtime property width reads a custom property: calc\(4px \* var\(--leaf-box, 1\)\)/u);
  assert.throws(() => requireShippedRuntime({ ...shipped, viewBindings: [{ ...shipped.viewBindings[0]!, property: '--silhouette-step' }] } as never),
    /fixture: prepared runtime viewBindings\[0\]\.property names or reads a custom property: --silhouette-step/u);
  assert.throws(() => requireShippedRuntime({ ...shipped, viewBindings: [{ ...shipped.viewBindings[0]!, groups: { '--silhouette-step-0': [2] } }] } as never),
    /fixture: prepared runtime viewBindings\[0\]\.groups has the key --silhouette-step-0, a custom property's name/u);
  assert.throws(() => requireShippedRuntime({ ...shipped, materials: [{ id: 'lighting', target: 2, rotation: { kind: 'angle', property: '--fixture-light-roll' } }] } as never),
    /fixture: prepared runtime materials\[0\]\.rotation\.property names or reads a custom property: --fixture-light-roll/u);
});
