import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createDestinationBrowser } from './destination-browser.mts';
import { required } from './test/navigation-test-values.mts';

test('destination panel publishes city fields, opens only once per selection and forwards reset', () => {
  const { document } = parseHTML('<section class="object-destination-panel" hidden><button class="object-destination-back"></button><h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section>');
  let openings = 0, resets = 0;
  const browser = required(createDestinationBrowser({ documentTarget: document, onSelected() { openings++; }, onReset() { resets++; } }));
  const panel = required(document.querySelector<HTMLElement>('section'));
  const back = required(document.querySelector<HTMLButtonElement>('button'));
  const city = { name: 'Lima', context: 'Peru', coverage: 'regional', bodyName: 'Earth', status: 'Flying…', flying: true };
  browser.present(null); assert.equal(panel.hidden, true); assert.equal(panel.ariaBusy, 'false');
  browser.present(city);
  assert.equal(openings, 1); assert.equal(panel.hidden, false); assert.equal(panel.ariaBusy, 'true');
  assert.equal(panel.dataset.coverage, 'regional');
  assert.equal(document.querySelector('.object-destination-name')?.textContent, 'Lima');
  assert.equal(document.querySelector('.object-destination-context')?.textContent, 'Peru');
  assert.equal(document.querySelector('.object-destination-status')?.textContent, 'Flying…');
  assert.equal(back.textContent, '← Back to Earth');
  browser.present({ ...city, flying: false, status: 'Arrived.' });
  assert.equal(openings, 1); assert.equal(panel.ariaBusy, 'false');
  back.click(); assert.equal(resets, 1);
  browser.present(null); browser.present(city); assert.equal(openings, 2);
  browser.destroy(); browser.present(city); assert.equal(panel.hidden, true);
  const empty = parseHTML('<div></div>').document;
  assert.equal(createDestinationBrowser({ documentTarget: empty, onSelected() {}, onReset() {} }), null);
});
