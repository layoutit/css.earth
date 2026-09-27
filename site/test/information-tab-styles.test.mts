import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { prepareInformationTabStyles } from '../server/information-tab-styles.mts';
import { createNavigationStyles } from '../navigation/navigation-styles.mts';

const card = (id: string) => `<section class="object-information-panel"><div class="object-native-tabs">
<input type="radio" id="${id}-facts-tab" name="${id}-information" data-information-tab="facts" aria-controls="${id}-facts" checked>
<input type="radio" id="${id}-data-tab" name="${id}-information" data-information-tab="data" aria-controls="${id}-data">
</div><section class="object-card-tabpanel" id="${id}-facts">Facts</section><section class="object-card-tabpanel" id="${id}-data">Data</section></section>`;
const page = (id: string) => {
  const html = card(id), styles = prepareInformationTabStyles(html);
  return parseHTML(`<html><head>${styles.map(s => `<style data-object-style="${s.key}">${s.css}</style>`).join('')}</head><body>${html}</body></html>`);
};

test('prepared rules target each radio-owned sibling without changing another card', () => {
  const html = card('earth') + card('lutetia');
  const styles = prepareInformationTabStyles(html);
  const { document } = parseHTML(html);
  const visibleSelectors = styles.flatMap(s => s.css.split('\n').filter(rule => rule.includes('display: block')).map(rule => rule.split(' {')[0]!));
  const visible = () => visibleSelectors.flatMap(selector => [...document.querySelectorAll(selector)].map(panel => panel.id)).sort();
  assert.deepEqual(visible(), ['earth-facts', 'lutetia-facts']);
  document.getElementById('earth-facts-tab')!.removeAttribute('checked');
  document.getElementById('earth-data-tab')!.setAttribute('checked', '');
  assert.deepEqual(visible(), ['earth-data', 'lutetia-facts']);
  assert.throws(() => prepareInformationTabStyles(card('earth').replace('aria-controls="earth-data"', 'aria-controls="missing"')), /sibling panels/);
});

test('card replacement and round trips keep prepared tab stylesheet nodes attached', async () => {
  const { document, window } = page('earth');
  const earthStyle = document.head.firstElementChild;
  const styles = createNavigationStyles(document, window);
  const incoming = await styles.prepare(page('lutetia').document, new URL('https://site.test/lutetia/'), new AbortController().signal);
  const retained = [...document.head.children];
  document.querySelector('.object-information-panel')!.replaceChildren(document.createElement('p'));
  assert.equal(earthStyle?.parentNode, document.head, 'placeholder insertion leaves the old stylesheet installed');
  incoming.apply();
  const returning = await styles.prepare(page('earth').document, new URL('https://site.test/earth/'), new AbortController().signal);
  returning.apply();
  assert.deepEqual([...document.head.children], retained, 'each group is installed once and reused');
});
