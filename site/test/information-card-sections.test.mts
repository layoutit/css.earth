import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { createTabsController } from '../information-card.mts';

const test = sourceTest();

test('programmatic dataset navigation selects its desktop tab and opens its disclosure', () => {
  const document = parseHTML('<div class="object-information-panel"><div class="object-native-tabs"><input type="radio" name="information" data-information-tab="factsheet" checked><input type="radio" name="information" data-information-tab="dataset"></div><section data-information-panel="factsheet"><p>Fact</p></section><details data-information-panel="dataset"></details></div>').document;
  const card = document.querySelector<HTMLElement>('.object-information-panel');
  assert.ok(card);
  const lifetime = createSceneLifetime();
  const controller = createTabsController(card, lifetime);
  const factsheet = card.querySelector<HTMLElement>('[data-information-panel="factsheet"]');
  const datasets = card.querySelector<HTMLDetailsElement>('[data-information-panel="dataset"]');
  const datasetTab = card.querySelector<HTMLInputElement>('[data-information-tab="dataset"]');
  assert.ok(factsheet && datasets && datasetTab);
  controller.show('dataset');
  assert.equal(datasetTab.checked, true);
  assert.equal(datasets.open, true);
  assert.equal(factsheet.textContent, 'Fact');
  lifetime.destroy();
});

test('a tab in a detached section, whose inert document has no window, still selects', () => {
  const page = parseHTML('<div class="object-information-panel"><input type="radio" name="information" data-information-tab="factsheet"></div>');
  const document = page.document;
  Object.defineProperty(document, 'defaultView', { value: null });
  // In a browser the global scope is the page's window, whose Event the inert document's elements accept.
  const nodeEvent = globalThis.Event;
  globalThis.Event = page.Event as typeof Event;
  try {
    const card = document.querySelector<HTMLElement>('.object-information-panel');
    const tab = card?.querySelector<HTMLInputElement>('[data-information-tab="factsheet"]');
    assert.ok(card && tab);
    let changes = 0;
    tab.addEventListener('change', () => { changes += 1; });
    const lifetime = createSceneLifetime();
    createTabsController(card, lifetime).show('factsheet');
    assert.equal(tab.checked, true);
    assert.equal(changes, 1);
    lifetime.destroy();
  } finally {
    globalThis.Event = nodeEvent;
  }
});
