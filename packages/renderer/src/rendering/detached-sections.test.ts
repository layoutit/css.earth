import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { sectionElements, sectionPlaceholder, showSection } from './detached-sections.js';

test('a section waits in its template until shown, and goes back into one when hidden', () => {
  const { document } = parseHTML(`<main><div class="card" data-id="a"><p class="row">a</p></div>
    <template data-detached-section><div class="card" data-id="b"><p class="row">b</p></div></template></main>`);
  const main = document.querySelector('main')!;
  const cards = sectionElements(main, '.card');
  expect(cards.map(card => card.dataset.id)).toEqual(['a', 'b']);
  expect(sectionElements(main, '.row').map(row => row.textContent)).toEqual(['a', 'b']);
  const [a, b] = cards as [HTMLElement, HTMLElement];
  expect(b.isConnected).toBe(false);
  showSection(b, true);
  showSection(a, false);
  expect([a.isConnected, b.isConnected]).toEqual([false, true]);
  expect([...main.children].map(child => child.localName)).toEqual(['template', 'div']);
  // A moved placeholder mounts its section where it now stands.
  const other = document.createElement('section'); main.append(other);
  other.append(sectionPlaceholder(a));
  showSection(a, true);
  expect(a.parentElement).toBe(other);
});
