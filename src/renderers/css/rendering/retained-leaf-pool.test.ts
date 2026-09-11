import { expect, test } from 'vitest';
import { createRetainedLeafPool, createRetainedGeometrySnapshot } from './retained-leaf-pool.js';

class Element {
  children: Element[] = [];
  parentNode: Element | null = null;
  style: Record<string, string> = {};
  className = '';
  readonly tagName: string;
  constructor(tagName = 'DIV') { this.tagName = tagName;}
  ownerDocument = { createElement: (tag: string) => new Element(tag.toUpperCase()) };
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
  expect(host.children.map(block => block.style.display)).toEqual(['contents', 'contents', 'none']);
  expect(elements[63].style.visibility).toBe('');
  pool.setVisible(63, false);
  expect(host.children.map(block => block.style.display)).toEqual(['none', 'contents', 'none']);
  pool.setVisible(129, true); pool.setVisible(64, false); pool.setVisible(63, true);
  expect(host.children.map(block => block.style.display)).toEqual(['contents', 'none', 'contents']);
  expect(pool.elements).toEqual(elements);
  expect(pool.elements.map(element => element.parentNode)).toEqual(parents);
  expect(host.children.map(block => block.children.length)).toEqual([64, 64, 2]);
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
