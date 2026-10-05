import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { createTabsController, mountInformationCard, restoreInformationPanels } from './information-card.mts';
import type { BrowserWindow } from './browser/browser-types.mts';

function fixture(saved: string | null) {
  const { document, window } = parseHTML('<html><body><aside><div class="object-information-panel"><details id="tree" class="atlas-tree-disclosure"></details><details id="facts"></details><details id="dataset" class="object-dataset-content"></details><div data-information-panel><details id="nested"></details></div></div></aside></body></html>');
  // linkedom represents details as HTMLElement; supply the browser constructor at this boundary.
  const writes: [string, string][] = [];
  const windowTarget = { HTMLElement: window.HTMLElement, HTMLDetailsElement: window.HTMLElement, Event: window.Event,
    localStorage: { getItem: () => saved, setItem: (key: string, value: string) => writes.push([key, value]) },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } as unknown as BrowserWindow;
  const card = document.querySelector<HTMLElement>('.object-information-panel')!;
  const panel = (id: string) => document.getElementById(id) as HTMLDetailsElement;
  panel('tree').open = true; panel('facts').open = true; panel('nested').open = false; panel('dataset').open = false;
  return { document, window: windowTarget, card, panel, writes };
}

test('saved panel lists restore direct and wrapped panels, preserve legacy tree defaults, and exclude datasets', () => {
  const f = fixture('["nested"]');
  f.panel('dataset').open = true;
  restoreInformationPanels(f.card, 'earth', f.window);
  assert.equal(f.panel('tree').open, true);
  assert.equal(f.panel('facts').open, false);
  assert.equal(f.panel('nested').open, true);
  assert.equal(f.panel('dataset').open, true);
  assert.deepEqual(f.writes, [], 'a preview installs no persistence listener');
  const modern = fixture('["tree-sections@1","facts","dataset"]');
  restoreInformationPanels(modern.card, 'mars', modern.window);
  assert.equal(modern.panel('tree').open, false);
  assert.equal(modern.panel('facts').open, true);
  assert.equal(modern.panel('nested').open, false);
  assert.equal(modern.panel('dataset').open, false, 'a saved dataset id is excluded from restoration');
});

test('invalid or inaccessible saved state preserves authored openness, including missing panel identities', () => {
  for (const saved of [null, '{', 'true', '["facts",3]']) {
    const f = fixture(saved);
    restoreInformationPanels(f.card, 'earth', f.window);
    assert.equal(f.panel('tree').open, true);
    assert.equal(f.panel('facts').open, true);
    assert.equal(f.panel('nested').open, false);
  }
  const f = fixture(null);
  Object.defineProperty(f.window, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
  assert.doesNotThrow(() => restoreInformationPanels(f.card, 'earth', f.window));
  f.panel('facts').removeAttribute('id');
  assert.throws(() => restoreInformationPanels(f.card, 'earth', f.window), /Object shell panel identity is missing\./);
});

test('mounted panels always expand the dataset and save the versioned open list on toggle', () => {
  const f = fixture('["tree-sections@1","nested"]'), lifetime = createSceneLifetime();
  const drawer = f.document.querySelector<HTMLElement>('aside')!;
  const controller = mountInformationCard(drawer, 'earth', f.window, lifetime);
  assert.equal(f.panel('dataset').open, true);
  controller.activatePanels();
  assert.equal(f.panel('tree').open, false);
  assert.equal(f.panel('nested').open, true);
  f.panel('facts').open = true;
  f.panel('facts').dispatchEvent(new f.window.Event('toggle'));
  assert.deepEqual(f.writes, [['css.earth:earth:panels', '["tree-sections@1","facts","nested"]']]);
  Object.defineProperty(f.window, 'localStorage', { value: { setItem() { throw new Error('quota'); } }, configurable: true });
  assert.doesNotThrow(() => f.panel('facts').dispatchEvent(new f.window.Event('toggle')));
  lifetime.destroy();
  const missing = fixture(null), otherLifetime = createSceneLifetime();
  const other = mountInformationCard(missing.document.querySelector<HTMLElement>('aside')!, 'earth', missing.window, otherLifetime);
  missing.card.remove();
  assert.throws(() => other.activatePanels(), /Object shell combined information panel is missing\./);
  otherLifetime.destroy();
});

test('group selection excludes hidden and other-group tabs; missing ids and retired controllers do nothing', () => {
  const { document } = parseHTML('<div><input name="a" data-information-tab="facts"><input name="b" data-information-group="system" data-information-tab="system"><input name="a" hidden data-information-tab="hidden"><details data-information-panel="facts"></details></div>');
  const card = document.querySelector<HTMLElement>('div')!, lifetime = createSceneLifetime();
  const facts = card.querySelector<HTMLInputElement>('[data-information-tab="facts"]')!;
  const system = card.querySelector<HTMLInputElement>('[data-information-tab="system"]')!;
  const hidden = card.querySelector<HTMLInputElement>('[data-information-tab="hidden"]')!;
  facts.checked = system.checked = hidden.checked = false;
  let changes = 0;
  facts.addEventListener('change', () => changes++);
  const tabs = createTabsController(card, lifetime, 'detail');
  tabs.show('system'); tabs.show('hidden'); tabs.show('absent');
  assert.equal(system.checked, false); assert.equal(hidden.checked, false); assert.equal(changes, 0);
  tabs.show('facts'); assert.equal(facts.checked, true); assert.equal(changes, 1);
  assert.equal(card.querySelector<HTMLDetailsElement>('details')!.open, undefined, 'grouped tabs do not open disclosures');
  tabs.destroy(); tabs.show('facts'); assert.equal(changes, 1);
  const empty = createTabsController(null, lifetime); assert.doesNotThrow(() => empty.show('facts'));
  lifetime.destroy();
});
