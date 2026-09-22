import { expect, test, vi } from 'vitest';
import { adoptPreparedTree, buildPreparedTree, preparePresentationTree } from './prepared-tree.js';
import type { PreparedTree } from './prepared-presentation.js';

const sha = 'a'.repeat(64);

function propertyFixture() {
  const document = { createElement(tag: string) {
    return { tag, style: { setProperty: vi.fn() } as Record<string, unknown> & { setProperty: (name: string, value: string) => void },
      setAttribute: vi.fn(), remove: vi.fn(), appendChild: vi.fn() };
  } } as unknown as Document;
  const tree: PreparedTree = { camera: 0, scene: 1, stageClasses: [], nodes: [{ tag: 'div', parent: -1, className: null, style: '',
    properties: [0, 1], attributes: {} }],
    properties: [
      { name: '--earth-surface-page-0', value: 'url("/scenes/earth/earth-surface-page-0-level-512.webp")', custom: true },
      { name: 'backgroundImage', value: 'url(/scenes/neptune/neptune-rings-wedges@2x.webp)', custom: false },
    ] };
  return { document, tree };
}

test('a baked custom or plain property url is rewritten against the asset origin', () => {
  const f = propertyFixture();
  const origin = { origin: 'https://earth-assets.lowpoly.cc', assets: { 'earth-surface-page-0-level-512.webp': sha, 'neptune-rings-wedges@2x.webp': sha } };
  const { nodes } = buildPreparedTree(f.tree, f.document, () => {}, undefined, origin);
  const style = nodes[0].style as unknown as { setProperty: ReturnType<typeof vi.fn>; backgroundImage: string };
  expect(style.setProperty).toHaveBeenCalledWith('--earth-surface-page-0', `url("https://earth-assets.lowpoly.cc/runtime-assets/${sha}/earth-surface-page-0-level-512.webp")`);
  expect(style.backgroundImage).toBe(`url(https://earth-assets.lowpoly.cc/runtime-assets/${sha}/neptune-rings-wedges@2x.webp)`);
});

test('a baked property url is left unresolved without an asset origin', () => {
  const f = propertyFixture();
  const { nodes } = buildPreparedTree(f.tree, f.document, () => {});
  const style = nodes[0].style as unknown as { setProperty: ReturnType<typeof vi.fn>; backgroundImage: string };
  expect(style.setProperty).toHaveBeenCalledWith('--earth-surface-page-0', 'url("/scenes/earth/earth-surface-page-0-level-512.webp")');
  expect(style.backgroundImage).toBe('url(/scenes/neptune/neptune-rings-wedges@2x.webp)');
});

function fixture() {
  const made: any[] = [];
  const document = { createElement(tag: string) {
    const node = { tag, parentNode: null as any, children: [] as any[], style: { setProperty: vi.fn() }, setAttribute: vi.fn(),
      remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; },
      appendChild(child: any) { child.remove(); child.parentNode = this; this.children.push(child); } };
    made.push(node); return node;
  } } as unknown as Document;
  const tree: PreparedTree = { nodes: Array.from({ length: 20 }, (_, i) => ({ tag: 'div', parent: i === 0 ? -1 : 0,
    className: `node-${i}`, style: '', properties: [], attributes: {} })), properties: [], camera: 0, scene: 1, stageClasses: [] };
  return { made, document, tree };
}

test('preflight yields while building detached nodes, then transfers the exact tree once', async () => {
  const f = fixture(), abort = new AbortController();
  let clock = 0;
  const time = vi.spyOn(performance, 'now').mockImplementation(() => ++clock);
  const yieldTask = vi.fn(async () => { expect(f.made[0].parentNode).toBeNull(); });
  try {
    const lease = await preparePresentationTree(f.tree, f.document, abort.signal, yieldTask);
    expect(yieldTask).toHaveBeenCalled();
    expect(f.made).toHaveLength(20);
    const cleanups: (() => void)[] = [];
    const built = lease.claim(f.tree, f.document, cleanup => cleanups.push(cleanup));
    expect(built.nodes).toEqual(f.made);
    expect(() => lease.claim(f.tree, f.document, () => {})).toThrow('another mount');
    abort.abort(); lease.destroy();
    expect(built.nodes).toHaveLength(20);
    expect(cleanups).toHaveLength(1);
  } finally { time.mockRestore(); }
});

test('cancellation retires partial construction without publishing roots or continuing work', async () => {
  const f = fixture(), abort = new AbortController();
  let clock = 0;
  const time = vi.spyOn(performance, 'now').mockImplementation(() => ++clock);
  try {
    await expect(preparePresentationTree(f.tree, f.document, abort.signal, async () => { abort.abort(); })).rejects.toThrow('cancelled');
    expect(f.made.length).toBeLessThan(20);
    expect(f.made[0].parentNode).toBeNull();
  } finally { time.mockRestore(); }
});

test('a detached lease rejects mismatched plans/documents and pre-claim disposal', async () => {
  const f = fixture();
  const lease = await preparePresentationTree(f.tree, f.document, new AbortController().signal);
  expect(() => lease.claim({ ...f.tree }, f.document, () => {})).toThrow('another mount');
  expect(() => lease.claim(f.tree, {} as Document, () => {})).toThrow('another mount');
  lease.destroy();
  expect(() => lease.claim(f.tree, f.document, () => {})).toThrow('cancelled');
});

class InitialNode {
  dataset: Record<string, string> = {};
  localName = 'div';
  parentElement: InitialNode | null = null;
  children: InitialNode[] = [];
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  append(child: InitialNode) { child.remove(); child.parentElement = this; this.children.push(child); }
  querySelectorAll(): InitialNode[] { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
}
function initialTree() {
  const tree: PreparedTree = { camera: 0, scene: 1, properties: [], stageClasses: [],
    nodes: [-1, 0, 0, 1].map(parent => ({ parent, tag: 'div', className: null, style: '', properties: [], attributes: {} })) };
  const stage = new InitialNode(); stage.dataset = { objectId: 'fixture', preparedObject: 'fixture' };
  const nodes = tree.nodes.map((record, index) => { const node = new InitialNode(); node.dataset.preparedNode = String(index); return node; });
  tree.nodes.forEach((record, index) => (record.parent === -1 ? stage : nodes[record.parent]).append(nodes[index]));
  return { tree, stage, nodes, element: stage as unknown as HTMLElement };
}

test('adoption preserves every existing node even when prepared order differs from DOM preorder', () => {
  const f = initialTree(), cleanups: (() => void)[] = [];
  const adopted = adoptPreparedTree(f.tree, f.element, cleanup => cleanups.push(cleanup));
  expect(adopted?.nodes).toEqual(f.nodes);
  expect(f.stage.dataset.preparedObject).toBeUndefined();
  expect(cleanups).toHaveLength(1);
  cleanups[0]();
  expect(f.stage.children).toEqual([]);
});

test.each(['missing', 'duplicate', 'parent', 'order', 'tag', 'object'] as const)('invalid %s cannot claim or replace the initial scene', kind => {
  const f = initialTree(), own = vi.fn();
  if (kind === 'missing') f.nodes[3].remove();
  if (kind === 'duplicate') f.nodes[3].dataset.preparedNode = '2';
  if (kind === 'parent') f.nodes[2].append(f.nodes[3]);
  if (kind === 'order') f.nodes[0].children.reverse();
  if (kind === 'tag') f.nodes[3].localName = 'span';
  if (kind === 'object') f.stage.dataset.objectId = 'another';
  expect(() => adoptPreparedTree(f.tree, f.element, own)).toThrow('Initial prepared tree');
  expect(own).not.toHaveBeenCalled();
  expect(f.stage.dataset.preparedObject).toBe('fixture');
});
