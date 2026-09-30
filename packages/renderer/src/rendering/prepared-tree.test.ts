import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { adoptPreparedTree, buildPreparedTree, preparePresentationTree } from './prepared-tree.js';
import type { PreparedTree } from './prepared-presentation.js';

const sha = 'a'.repeat(64);

function propertyFixture() {
  const document = { createElement(tag: string) {
    return { tag, style: { setProperty: mock.fn(() => {}) } as Record<string, unknown> & { setProperty: (name: string, value: string) => void },
      setAttribute: mock.fn(() => {}), remove: mock.fn(() => {}), appendChild: mock.fn(() => {}) };
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
  const style = nodes[0].style as unknown as { setProperty: ReturnType<typeof mock.fn>; backgroundImage: string };
  assert.ok(style.setProperty.mock.calls.some(call => isDeepStrictEqual(call.arguments, ['--earth-surface-page-0', `url("https://earth-assets.lowpoly.cc/runtime-assets/${sha}/earth-surface-page-0-level-512.webp")`])));
  assert.equal(style.backgroundImage, `url(https://earth-assets.lowpoly.cc/runtime-assets/${sha}/neptune-rings-wedges@2x.webp)`);
});

test('a tree resolves its urls once per asset origin, and another origin or none reads its own', () => {
  const f = propertyFixture();
  const assets = { 'earth-surface-page-0-level-512.webp': sha, 'neptune-rings-wedges@2x.webp': sha };
  const first = { origin: 'https://earth-assets.lowpoly.cc', assets }, second = { origin: 'https://other.example', assets };
  const image = (origin?: typeof first) => (buildPreparedTree(f.tree, f.document, () => {}, undefined, origin).nodes[0].style as unknown as { backgroundImage: string }).backgroundImage;
  assert.equal(image(first), `url(https://earth-assets.lowpoly.cc/runtime-assets/${sha}/neptune-rings-wedges@2x.webp)`);
  assert.equal(image(second), `url(https://other.example/runtime-assets/${sha}/neptune-rings-wedges@2x.webp)`);
  assert.equal(image(first), `url(https://earth-assets.lowpoly.cc/runtime-assets/${sha}/neptune-rings-wedges@2x.webp)`, 'a remount reads the same resolved value');
  assert.equal(image(), 'url(/scenes/neptune/neptune-rings-wedges@2x.webp)');
  assert.throws(() => buildPreparedTree(f.tree, f.document, () => {}, undefined, { origin: 'https://earth-assets.lowpoly.cc', assets: {} }), /No published asset hash/);
});

test('a baked property url is left unresolved without an asset origin', () => {
  const f = propertyFixture();
  const { nodes } = buildPreparedTree(f.tree, f.document, () => {});
  const style = nodes[0].style as unknown as { setProperty: ReturnType<typeof mock.fn>; backgroundImage: string };
  assert.ok(style.setProperty.mock.calls.some(call => isDeepStrictEqual(call.arguments, ['--earth-surface-page-0', 'url("/scenes/earth/earth-surface-page-0-level-512.webp")'])));
  assert.equal(style.backgroundImage, 'url(/scenes/neptune/neptune-rings-wedges@2x.webp)');
});

function fixture() {
  const made: any[] = [];
  const document = { createElement(tag: string) {
    const node = { tag, parentNode: null as any, children: [] as any[], style: { setProperty: mock.fn(() => {}) }, setAttribute: mock.fn(() => {}),
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
  const time = mock.method(performance, 'now', () => ++clock);
  const yieldTask = mock.fn(async () => { assert.equal(f.made[0].parentNode, null); });
  try {
    const lease = await preparePresentationTree(f.tree, f.document, abort.signal, yieldTask);
    assert.ok(yieldTask.mock.callCount() > 0);
    assert.equal(f.made.length, 20);
    const cleanups: (() => void)[] = [];
    const built = lease.claim(f.tree, f.document, cleanup => cleanups.push(cleanup));
    assert.deepEqual(built.nodes, f.made);
    assert.throws(() => lease.claim(f.tree, f.document, () => {}), /another mount/);
    abort.abort(); lease.destroy();
    assert.equal(built.nodes.length, 20);
    assert.equal(cleanups.length, 1);
  } finally { time.mock.restore(); }
});

test('cancellation retires partial construction without publishing roots or continuing work', async () => {
  const f = fixture(), abort = new AbortController();
  let clock = 0;
  const time = mock.method(performance, 'now', () => ++clock);
  try {
    await assert.rejects(preparePresentationTree(f.tree, f.document, abort.signal, async () => { abort.abort(); }), /cancelled/);
    assert.ok(f.made.length < 20);
    assert.equal(f.made[0].parentNode, null);
  } finally { time.mock.restore(); }
});

test('a detached lease rejects mismatched plans/documents and pre-claim disposal', async () => {
  const f = fixture();
  const lease = await preparePresentationTree(f.tree, f.document, new AbortController().signal);
  assert.throws(() => lease.claim({ ...f.tree }, f.document, () => {}), /another mount/);
  assert.throws(() => lease.claim(f.tree, {} as Document, () => {}), /another mount/);
  lease.destroy();
  assert.throws(() => lease.claim(f.tree, f.document, () => {}), /cancelled/);
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
  assert.deepEqual(adopted?.nodes, f.nodes);
  assert.equal(f.stage.dataset.preparedObject, undefined);
  assert.equal(cleanups.length, 1);
  cleanups[0]();
  assert.deepEqual(f.stage.children, []);
});

for (const kind of ['missing', 'duplicate', 'parent', 'order', 'tag', 'object'] as const) test(`invalid ${kind} cannot claim or replace the initial scene`, () => {
  const f = initialTree(), own = mock.fn(() => {});
  if (kind === 'missing') f.nodes[3].remove();
  if (kind === 'duplicate') f.nodes[3].dataset.preparedNode = '2';
  if (kind === 'parent') f.nodes[2].append(f.nodes[3]);
  if (kind === 'order') f.nodes[0].children.reverse();
  if (kind === 'tag') f.nodes[3].localName = 'span';
  if (kind === 'object') f.stage.dataset.objectId = 'another';
  assert.throws(() => adoptPreparedTree(f.tree, f.element, own), /Initial prepared tree/);
  assert.equal(own.mock.callCount(), 0);
  assert.equal(f.stage.dataset.preparedObject, 'fixture');
});

test('adoption builds a hidden subtree the server omitted, and refuses a partial one', () => {
  const tree: PreparedTree = { camera: 0, scene: 1, properties: [], stageClasses: [],
    nodes: [-1, 0, 0, 2, 3].map(parent => ({ parent, tag: 'div', className: 'leaf', style: '', properties: [], attributes: { 'data-kind': 'hidden' } })) };
  const initial = (count: number) => {
    const stage = new InitialNode(); stage.dataset = { objectId: 'fixture', preparedObject: 'fixture' };
    const document = { createElement: () => Object.assign(new InitialNode(), { style: {}, className: '', setAttribute: mock.fn(() => {}),
      appendChild(this: InitialNode, child: InitialNode) { this.append(child); } }) };
    Object.assign(stage, { ownerDocument: document });
    const nodes = tree.nodes.slice(0, count).map((_, index) => { const node = Object.assign(new InitialNode(), { appendChild(this: InitialNode, child: InitialNode) { this.append(child); } });
      node.dataset.preparedNode = String(index); return node; });
    tree.nodes.slice(0, count).forEach((record, index) => (record.parent === -1 ? stage : nodes[record.parent]).append(nodes[index]));
    return { stage, nodes };
  };
  const whole = initial(3);
  // Node 2's subtree is hidden: its descendants are the omitted nodes.
  const adopted = adoptPreparedTree(tree, whole.stage as unknown as HTMLElement, () => {}, new Set([3, 4]));
  assert.deepEqual(adopted?.nodes.slice(0, 3), whole.nodes);
  assert.deepEqual(whole.nodes[2].children, [adopted?.nodes[3]]);
  assert.deepEqual(adopted?.nodes[3].children, [adopted?.nodes[4]]);
  // Without the hidden declaration, or with the subtree cut part-way, the initial scene stays unclaimed.
  assert.throws(() => adoptPreparedTree(tree, initial(3).stage as unknown as HTMLElement, () => {}), /Initial prepared tree/);
  assert.throws(() => adoptPreparedTree(tree, initial(4).stage as unknown as HTMLElement, () => {}, new Set([3, 4])), /Initial prepared tree/);
});
