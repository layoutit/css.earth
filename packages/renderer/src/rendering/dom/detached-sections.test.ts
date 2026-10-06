import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { sectionElements, sectionPlaceholder, showSection } from './detached-sections.js';

/** Mounted: in the page and not waiting in a template (a server DOM keeps a template's section connected). */
const mounted = (element: Element) => element.isConnected && !element.closest('template');

test('a section waits in its template until shown, and goes back into one when hidden', () => {
  const { document } = parseHTML(`<main><div class="card" data-id="a"><p class="row">a</p></div>
    <template data-detached-section><div class="card" data-id="b"><p class="row">b</p></div></template></main>`);
  const main = document.querySelector('main')!;
  const cards = sectionElements(main, '.card');
  assert.deepEqual(cards.map(card => card.dataset.id), ['a', 'b']);
  assert.deepEqual(sectionElements(main, '.row').map(row => row.textContent), ['a', 'b']);
  const [a, b] = cards as [HTMLElement, HTMLElement];
  assert.equal(mounted(b), false);
  showSection(b, true);
  showSection(a, false);
  assert.deepEqual(([mounted(a), mounted(b)]), [false, true]);
  assert.deepEqual([...main.children].map(child => child.localName), ['template', 'div']);
  // A moved placeholder mounts its section where it now stands.
  const other = document.createElement('section'); main.append(other);
  other.append(sectionPlaceholder(a));
  showSection(a, true);
  assert.equal(a.parentElement, other);
});

test('a section in a template nested inside another is found in its content', () => {
  // A browser parses a template inside another's content into that inert document: its section is in its content, and
  // the content shares the template's document, as a server DOM's does.
  const { document } = parseHTML('<main><template data-detached-section><div class="card"></div></template></main>');
  const inner = document.createElement('template') as Element & { content: DocumentFragment };
  inner.setAttribute('data-detached-section', '');
  sectionElements(document.querySelector('main')!, '.card')[0]!.append(inner);
  const row = document.createElement('p'); row.className = 'row';
  inner.content.append(row);
  assert.equal(inner.children.length, 0);
  assert.deepEqual(sectionElements(document.querySelector('main')!, '.row'), [row]);
});

test('a server DOM keeps a detached section in its markup', () => {
  const { document } = parseHTML('<main><div class="card" data-id="a">a</div><div class="card" data-id="b">b</div></main>');
  const main = document.querySelector('main')!;
  const [a] = sectionElements(main, '.card') as HTMLElement[];
  showSection(a!, false);
  // Re-parsing the serialized page finds the section in its template, and it mounts again.
  const again = parseHTML(main.outerHTML).document.querySelector('main')!;
  const cards = sectionElements(again, '.card');
  assert.deepEqual(cards.map(card => card.dataset.id), ['a', 'b']);
  showSection(cards[0]!, true);
  assert.deepEqual([...again.querySelectorAll('.card')].map(card => (card as HTMLElement).dataset.id), ['a', 'b']);
});
