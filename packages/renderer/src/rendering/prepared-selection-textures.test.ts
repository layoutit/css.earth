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

test('an alternative surface profile is hidden before its shared atlas changes', () => {
  const values = new Map<string, string>([
    ['--fixture-surface-image', 'url("/a.webp")'],
    ['--fixture-a-display', 'block'],
    ['--fixture-b-display', 'none'],
  ]);
  const invalid: string[] = [];
  const style = {
    setProperty(name: string, value: string) {
      values.set(name, value);
      if (values.get('--fixture-surface-image') === 'url("/b.webp")' && values.get('--fixture-a-display') !== 'none') invalid.push('new atlas with old profile');
      if (values.get('--fixture-b-display') === 'block' && values.get('--fixture-surface-image') !== 'url("/b.webp")') invalid.push('new profile with old atlas');
    },
    getPropertyValue(name: string) { return values.get(name) ?? ''; },
  };
  const nodes = [0, 1, 2].map(() => ({ style, parentNode: null }));
  const stage = { ownerDocument: {}, appendChild(node: typeof nodes[number]) { node.parentNode = this as never; } };
  const definition = { tree: { nodes: [], camera: 0, scene: 1, stageClasses: [] }, materials: [], animations: [], viewBindings: [],
    variants: [{ when: { lensId: 'b' }, writes: [
      { kind: 'texture', target: 2, name: '--fixture-surface-image', resource: 'b', quoted: true },
      { kind: 'style', target: 2, name: '--fixture-a-display', value: 'none' },
      { kind: 'style', target: 2, name: '--fixture-b-display', value: 'block' },
    ] }],
  } as unknown as PreparedPresentationDefinition;
  const presentation = mountPreparedPresentation(stage as unknown as HTMLElement,
    { own() {}, registerAnimation() {}, seekAnimation() {} }, definition,
    { claim: () => ({ nodes: nodes as unknown as HTMLElement[], roots: [nodes[0]] as unknown as HTMLElement[] }), destroy() {} });
  const resources: PreparedResources = {
    has: key => key === 'b', read: () => null, url: key => key === 'b' ? '/b.webp' : null, readyKeys: () => ['b'],
  };
  presentation.commitSelection({ selection: { lensId: 'b' }, resources });
  expect(invalid).toEqual([]);
  expect(Object.fromEntries(values)).toMatchObject({
    '--fixture-surface-image': 'url("/b.webp")',
    '--fixture-a-display': 'none',
    '--fixture-b-display': 'block',
  });
});
