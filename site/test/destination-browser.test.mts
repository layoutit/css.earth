import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { createDestinationBrowser } from '../destination-browser.mts';

function mount() {
  const { document } = parseHTML(`<section class="object-destination-panel" hidden><button class="object-destination-back"></button>
    <h2 class="object-destination-name"></h2><p class="object-destination-context"></p><p class="object-destination-status"></p></section>`);
  const browser = createDestinationBrowser({ documentTarget: document, onSelected() {}, onReset() {} })!;
  return { browser, panel: document.querySelector<HTMLElement>('.object-destination-panel')! };
}
const city = { name: 'Lima', context: 'Earth', coverage: 'global', bodyName: 'Earth', status: 'Arrived.', flying: false };

test('a cleared city panel stays hidden', () => {
  const { browser, panel } = mount();
  browser.present(city);
  assert.equal(panel.hidden, false);
  browser.present(null);
  assert.equal(panel.hidden, true);
});

test('a disposed panel cannot be republished by a late result', () => {
  const { browser, panel } = mount();
  browser.destroy();
  browser.present(city);
  assert.equal(panel.hidden, true);
});
