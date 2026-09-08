import { expect, test } from 'vitest';
import { createRetainedLeafPool } from './retained-leaf-pool.js';

class Element {
  children: Element[] = [];
  parentNode: Element | null = null;
  style: Record<string, string> = {};
  className = '';
  ownerDocument = { createElement: () => new Element() };
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
