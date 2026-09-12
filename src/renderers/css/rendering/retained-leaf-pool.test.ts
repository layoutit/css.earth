import { expect, test } from 'vitest';
import { createRetainedLeafPool, createRetainedGeometrySnapshot } from './retained-leaf-pool.js';

class Element {
  children: Element[] = [];
  parentNode: Element | null = null;
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
  className = '';
  readonly tagName: string;
  constructor(tagName = 'DIV') { this.tagName = tagName;}
  ownerDocument = {
    createElement: (tag: string) => new Element(tag.toUpperCase()),
    createElementNS: (_namespace: string, tag: string) => new Element(tag),
  };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  appendChild(child: Element) { child.parentNode = this; this.children.push(child); }
}

test('dormant blocks leave layout without detaching, reallocating, or hiding active neighbours', () => {
  const host = new Element();
  const pool = createRetainedLeafPool(host as unknown as HTMLElement, 130, 'points');
  const elements = [...pool.elements], parents = elements.map(element => element.parentNode);
  expect(host.children.map(block => block.style.display)).toEqual(['none', 'none', 'none']);
  pool.setVisible(0, true); pool.setVisible(63, true); pool.setVisible(64, true);
  pool.setVisible(0, true); // repeated publication must not retain a phantom active leaf
  pool.setVisible(0, false);
  pool.commitVisibility();
  expect(host.children.map(block => block.style.display)).toEqual(['contents', 'contents', 'none']);
  expect(elements[63].style.visibility).toBe('');
  pool.setVisible(63, false);
  pool.commitVisibility();
  expect(host.children.map(block => block.style.display)).toEqual(['none', 'contents', 'none']);
  pool.setVisible(129, true); pool.setVisible(64, false); pool.setVisible(63, true);
  pool.commitVisibility();
  expect(host.children.map(block => block.style.display)).toEqual(['contents', 'none', 'contents']);
  expect(pool.elements).toEqual(elements);
  expect(pool.elements.map(element => element.parentNode)).toEqual(parents);
  expect(host.children.map(block => block.children.length)).toEqual([64, 64, 2]);
});

test('replacing the last visible member publishes only final block membership', () => {
  const host = new Element();
  const pool = createRetainedLeafPool(host as unknown as HTMLElement, 128, 'points');
  pool.setVisible(0, true); pool.commitVisibility();
  let writes = 0;
  host.children[0].style = new Proxy(host.children[0].style, {
    set(target, key, value) { if (key === 'display') writes++; return Reflect.set(target, key, value); },
  });
  pool.setVisible(0, false); pool.setVisible(1, true); pool.commitVisibility();
  expect(writes).toBe(0);
  expect(host.children[0].style.display).toBe('contents');
  pool.setVisible(64, true); pool.setVisible(64, false); pool.commitVisibility();
  expect(host.children[1].style.display).toBe('none');
  expect(pool.stats()).toMatchObject({ blockActivations: 1, blockDeactivations: 0 });
  pool.setVisible(1, false); pool.commitVisibility(); pool.commitVisibility();
  expect(writes).toBe(1);
  expect(pool.stats()).toMatchObject({ blockActivations: 1, blockDeactivations: 1 });
});

test('retained commits keep an emptied block in layout until its membership stays empty', () => {
  const host = new Element();
  const pool = createRetainedLeafPool(host as unknown as HTMLElement, 128, 'points', { retainCommits: 2 });
  pool.setVisible(0, true); pool.commitVisibility();
  pool.setVisible(0, false); pool.commitVisibility(); pool.commitVisibility();
  expect(host.children[0].style.display).toBe('contents');
  pool.setVisible(1, true); pool.commitVisibility(); // returning membership reuses the resident block
  pool.setVisible(1, false); pool.commitVisibility(); pool.commitVisibility();
  expect(host.children[0].style.display).toBe('contents');
  expect(pool.stats()).toMatchObject({ blockActivations: 1, blockDeactivations: 0, visibleLeaves: 0 });
  pool.commitVisibility();
  expect(host.children[0].style.display).toBe('none');
  expect(pool.stats()).toMatchObject({ blockActivations: 1, blockDeactivations: 1, residentLeaves: 0 });
});

test('sparse prefixes preserve all slots while reducing dormant layout across boundary crossings', () => {
  const dense = createRetainedLeafPool(new Element() as unknown as HTMLElement, 130, 'points');
  const host = new Element();
  const sparse = createRetainedLeafPool(host as unknown as HTMLElement, 130, 'points', { sparsePrefix: true });
  const identities = [...sparse.elements], parents = identities.map(node => node.parentNode);
  for (const direction of [1, -1]) for (let step = 0; step < 130; step++) {
    const index = direction === 1 ? step : 129 - step;
    for (const pool of [dense, sparse]) { pool.setVisible(index, direction === 1); pool.commitVisibility(); }
    expect(sparse.stats().visibleLeaves).toBe(dense.stats().visibleLeaves);
    expect(sparse.stats().residentLeaves).toBeLessThanOrEqual(dense.stats().residentLeaves);
    expect(sparse.elements.map(node => node.style.visibility)).toEqual(dense.elements.map(node => node.style.visibility));
  }
  for (const index of [0, 9, 31, 63, 128]) sparse.setVisible(index, true);
  sparse.commitVisibility();
  expect(sparse.stats().visibleLeaves).toBe(5);
  expect(sparse.stats().residentLeaves).toBe(66);
  sparse.setVisible(0, false); sparse.setVisible(9, false); sparse.setVisible(31, false); sparse.setVisible(63, false);
  sparse.commitVisibility();
  expect(sparse.stats().residentLeaves).toBe(2);
  expect(sparse.elements).toEqual(identities);
  expect(sparse.elements.map(node => node.parentNode)).toEqual(parents);
  expect(createRetainedGeometrySnapshot(sparse.elements)().directlyHiddenLeaves).toBe(129);
});

test('diagnostic membership matches direct visibility without scanning complete pools', () => {
  const host = new Element();
  const pool = createRetainedLeafPool(host as unknown as HTMLElement, 130, 'points');
  const extra = new Element('S'); extra.style.visibility = 'hidden';
  const nodes = [...host.children, ...pool.elements, extra] as unknown as HTMLElement[];
  const snapshot = createRetainedGeometrySnapshot(nodes);
  let pooledReads = 0;
  for (const leaf of pool.elements) {
    const style = leaf.style;
    Object.defineProperty(leaf, 'style', { value: new Proxy(style, {
      get(target, key) { if (key === 'visibility') pooledReads++; return Reflect.get(target, key); },
    }) });
  }
  const verify = () => {
    const expected = pool.elements.reduce((sum, leaf) => sum + Number(leaf.style.visibility === 'hidden'), 0) +
      Number(extra.style.visibility === 'hidden');
    pooledReads = 0;
    expect(snapshot()).toEqual({ retainedNodes: nodes.length, retainedLeaves: 131, directlyHiddenLeaves: expected });
    expect(pooledReads).toBe(0);
  };
  verify();
  for (let index = 0; index < 130; index++) {
    pool.setVisible(index, true); pool.setVisible(index, true); verify();
  }
  extra.style.visibility = ''; verify();
  for (let index = 129; index >= 0; index--) { pool.setVisible(index, false); verify(); }
});

test('diagnostics count only captured leaves when a retained block is partial', () => {
  const host = new Element();
  const pool = createRetainedLeafPool(host as unknown as HTMLElement, 130, 'points');
  const snapshot = createRetainedGeometrySnapshot(pool.elements.slice(0, 65));
  pool.setVisible(129, true); // a different block is outside this identity snapshot
  pool.setVisible(65, true); // an uncaptured sibling is not counted
  expect(snapshot().directlyHiddenLeaves).toBe(65);
  pool.setVisible(64, true); pool.setVisible(63, true);
  expect(snapshot().directlyHiddenLeaves).toBe(63);
  pool.setVisible(64, false);
  expect(snapshot().directlyHiddenLeaves).toBe(64);
});

