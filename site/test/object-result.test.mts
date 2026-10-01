import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { parseHTML } from 'linkedom';
import type { CatalogueRow } from '../search/catalogue-index.mts';
import { renderCatalogueRows } from '../search/catalogue-window.mts';
import { objectResultMarkup } from '../server/object-result-markup.mts';
const test = sourceTest();

const earth: CatalogueRow = {
  kind: 'scene', id: 'earth', name: 'Earth', classificationName: 'planet', route: '/earth/',
  detail: { text: '1.009 AU', value: '1.009', unit: 'AU', title: 'Prepared distance', ariaLabel: '1.009 AU. Prepared distance' },
  source: { subject: 'object:earth', document: '/sources/earth/', label: 'Earth sources' },
  marker: { kind: 'scene', id: 'earth', color: '#fff' },
};

test('system and search rows render the same component, including its metadata and preview', () => {
  const { document } = parseHTML('<ul></ul>');
  const list = document.querySelector('ul')!;
  renderCatalogueRows(document, list, [earth]);
  const search = list.querySelector('a')!;
  assert.equal(objectResultMarkup(earth), search.outerHTML);
  assert.equal(search.querySelector('img')?.getAttribute('width'), '40');
  assert.equal(search.querySelector('.object-distance')?.textContent, 'Planet · 1.009 AU');
  assert.equal(search.dataset.objectId, 'earth');
  assert.equal(search.querySelector('img')?.getAttribute('loading'), 'lazy');
  assert.equal(search.querySelector('.object-distance')?.getAttribute('aria-label'), earth.detail.ariaLabel);
});

test('the shared server row escapes authored names and attributes', () => {
  const markup = objectResultMarkup({ ...earth, name: '<script>bad()</script>',
    detail: { ...earth.detail, title: '" onmouseover="bad()' } });
  const { document } = parseHTML(markup);
  assert.equal(document.querySelector('script'), null);
  assert.equal(document.querySelector('[onmouseover]'), null);
  assert.equal(document.querySelector('.object-name')?.textContent, '<script>bad()</script>');
  assert.equal(document.querySelector('.object-distance')?.getAttribute('title'), '" onmouseover="bad()');
});


test('overview navigation shares the row without a fabricated distance or focus target', () => {
  const { document } = parseHTML(objectResultMarkup({ kind: 'overview', id: 'milky-way', name: 'Milky Way',
    route: '/milky-way/', classificationName: 'galaxy', source: earth.source,
    marker: { kind: 'thumbnail', thumbnail: '/navigation/focus-milky-way@2x.webp' } }));
  const link = document.querySelector('a')!;
  assert.equal(link.getAttribute('href'), '/milky-way/');
  assert.equal(link.dataset.objectId, undefined);
  assert.equal(link.querySelector('img')?.getAttribute('width'), '40');
  assert.equal(link.querySelector('.object-distance')?.textContent, 'Galaxy');
  assert.equal(link.querySelector('.object-distance')?.hasAttribute('aria-label'), false);
});
