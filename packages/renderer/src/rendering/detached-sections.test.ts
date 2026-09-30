import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { sectionElements, sectionPlaceholder, showSection } from './detached-sections.js';

/** Mounted: in the page and not waiting in a template (a server DOM keeps a template's section connected). */
const mounted = (element: Element) => element.isConnected && !element.closest('template');

test('a section waits in its template until shown, and goes back into one when hidden', () => {
  const { document } = parseHTML(`<main><div class="card" data-id="a"><p class="row">a</p></div>
    <template data-detached-section><div class="card" data-id="b"><p class="row">b</p></div></template></main>`);
  const main = document.querySelector('main')!;
  const cards = sectionElements(main, '.card');
  expect(cards.map(card => card.dataset.id)).toEqual(['a', 'b']);
  expect(sectionElements(main, '.row').map(row => row.textContent)).toEqual(['a', 'b']);
  const [a, b] = cards as [HTMLElement, HTMLElement];
  expect(mounted(b)).toBe(false);
  showSection(b, true);
  showSection(a, false);
  expect([mounted(a), mounted(b)]).toEqual([false, true]);
  expect([...main.children].map(child => child.localName)).toEqual(['template', 'div']);
  // A moved placeholder mounts its section where it now stands.
  const other = document.createElement('section'); main.append(other);
  other.append(sectionPlaceholder(a));
  showSection(a, true);
  expect(a.parentElement).toBe(other);
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
  expect(inner.children.length).toBe(0);
  expect(sectionElements(document.querySelector('main')!, '.row')).toEqual([row]);
});

test('a server DOM keeps a detached section in its markup', () => {
  const { document } = parseHTML('<main><div class="card" data-id="a">a</div><div class="card" data-id="b">b</div></main>');
  const main = document.querySelector('main')!;
  const [a] = sectionElements(main, '.card') as HTMLElement[];
  showSection(a!, false);
  // Re-parsing the serialized page finds the section in its template, and it mounts again.
  const again = parseHTML(main.outerHTML).document.querySelector('main')!;
  const cards = sectionElements(again, '.card');
  expect(cards.map(card => card.dataset.id)).toEqual(['a', 'b']);
  showSection(cards[0]!, true);
  expect([...again.querySelectorAll('.card')].map(card => (card as HTMLElement).dataset.id)).toEqual(['a', 'b']);
});
