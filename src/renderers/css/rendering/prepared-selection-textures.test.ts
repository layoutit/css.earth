import { expect, test } from 'vitest';
import { mountPreparedPresentation, type PreparedPresentationDefinition } from './prepared-presentation.js';
import type { PreparedResources } from './prepared-residency.js';

function fixture() {
  const nodes = [0, 1, 2, 3].map(() => ({ style: { backgroundImage: 'none' }, parentNode: null }));
  const stage = { ownerDocument: {}, appendChild(node: typeof nodes[number]) { node.parentNode = this as never; } };
  const definition = { tree: { nodes: [], camera: 0, scene: 1, stageClasses: [] }, materials: [], animations: [], viewBindings: [],
    variants: [
      { when: { lensId: 'a' }, writes: [{ kind: 'texture', target: 2, name: 'backgroundImage', resource: 'a', quoted: true }] },
      { when: { lensId: 'b' }, writes: [{ kind: 'texture', target: 3, name: 'backgroundImage', resource: 'b', quoted: true }] },
      { when: { lensId: 'fixed' }, writes: [{ kind: 'style', target: 2, name: 'backgroundImage', value: 'url("/fixed.webp")' }] },
    ] } as unknown as PreparedPresentationDefinition;
  const ready = new Set(['a', 'b']);
  const resources = { url(key: string) { return ready.has(key) ? `/${key}.webp` : null; } } as PreparedResources;
  const presentation = mountPreparedPresentation(stage as unknown as HTMLElement,
    { own() {}, registerAnimation() {}, seekAnimation() {} }, definition,
    { claim: () => ({ nodes: nodes as unknown as HTMLElement[], roots: [nodes[0]] as unknown as HTMLElement[] }), destroy() {} });
  return { nodes, ready, select: (lensId: string) => presentation.commitSelection({ selection: { lensId }, resources }) };
}

test('dataset replacement retires only its former texture references without replacing nodes', () => {
  const f = fixture(), identities = [...f.nodes];
  f.select('a');
  expect(f.nodes[2].style.backgroundImage).toBe('url("/a.webp")');
  f.select('b');
  expect(f.nodes[2].style.backgroundImage).toBe('none');
  expect(f.nodes[3].style.backgroundImage).toBe('url("/b.webp")');
  f.select('a');
  expect(f.nodes[2].style.backgroundImage).toBe('url("/a.webp")');
  expect(f.nodes[3].style.backgroundImage).toBe('none');
  expect(f.nodes).toEqual(identities);
});

test('an undecoded replacement leaves the entire previous dataset published', () => {
  const f = fixture(); f.select('a'); f.ready.delete('b');
  expect(() => f.select('b')).toThrow('not ready');
  expect(f.nodes[2].style.backgroundImage).toBe('url("/a.webp")');
  expect(f.nodes[3].style.backgroundImage).toBe('none');
});

test('a successor style takes ownership of the same texture property', () => {
  const f = fixture(); f.select('a'); f.select('fixed');
  expect(f.nodes[2].style.backgroundImage).toBe('url("/fixed.webp")');
  f.select('b');
  expect(f.nodes[2].style.backgroundImage).toBe('url("/fixed.webp")');
});
