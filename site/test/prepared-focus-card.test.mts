import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedFocusCard } from '../prepared-focus-card.mts';
import type { PreparedGalaxyRecord } from '@cssearth/catalog';
import type { PreparedFocusPresentation } from '../prepared-context-navigation.mts';

class Element extends EventTarget {
  dataset: Record<string, string> = {}; selectors = new Map<string, Element | Element[]>(); attributes = new Map<string, string>(); hidden = false; checked = false; disabled = false; textContent = '';
  querySelector(selector: string) { const value = this.selectors.get(selector); return value instanceof Element ? value : null; }
  querySelectorAll(selector: string) { const value = this.selectors.get(selector); return Array.isArray(value) ? value : []; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
function fixture(unavailableObjects = '') {
  const root = new Element(), bank = new Element(), datasetTab = new Element();
  const tabs: string[] = [];
  root.selectors.set('[data-information-tab="dataset"]', datasetTab);
  const unavailable = new Element(); unavailable.dataset.unavailableObjects = unavailableObjects;
  root.selectors.set('[data-focus-unavailable]', unavailable);
  bank.dataset.focusLensBank = 'prepared-galaxy';
  const ids = ['first', 'second', 'third'];
  const buttons = ids.map(id => Object.assign(new Element(), { value: id }));
  const details = ids.map(id => Object.assign(new Element(), { dataset: { focusLensDetails: id } }));
  bank.selectors.set('[data-focus-lens]', buttons);
  bank.selectors.set('[data-focus-lens-details]', details);
  const factsBank = new Element(); factsBank.dataset.focusFactsBank = 'prepared-galaxy';
  const facts = ids.map(id => Object.assign(new Element(), { dataset: { focusLensDetails: id }, textContent: 'Source pixels 2048 × 4096' }));
  factsBank.selectors.set('[data-focus-lens-details]', facts);
  root.selectors.set('[data-focus-lens-bank], [data-focus-facts-bank]', [bank, factsBank]);
  for (const name of ['name', 'aliases', 'status', 'distance', 'uncertainty', 'membership', 'association', 'basis', 'reference']) {
    root.selectors.set(`[data-focus-${name}]`, new Element());
  }
  const record: PreparedGalaxyRecord = { id: 'catalogue:galaxy', detailedObjectId: 'prepared-galaxy', name: 'Prepared galaxy', aliases: [], status: 'confirmed',
    positionM: [0, 0, 0], skyPosition: { raDeg: 0, decDeg: 0, sourceRef: 'observations' },
    distance: { valuePc: 50000, sourceRef: 'observations', method: 'Published distance' }, membership: { group: 'local-group', subgroup: 'milky-way', basis: 'Published membership' } };
  const presentation: PreparedFocusPresentation = { id: 'first', defaultLens: 'first', objectId: 'prepared-galaxy', selectedLens: 'first', starsVisible: true,
    lenses: ids.map(id => ({ id, label: id, title: id, description: id, sourceUrl: 'https://example.test/source' })), selectLens() {} };
  // This retained DOM stand-in implements only the card's queried fields and events.
  return { root, bank, factsBank, facts, buttons, details, record, presentation, datasetTab, tabs, unavailable,
    card: createPreparedFocusCard(root as unknown as HTMLElement, id => tabs.push(id)) };
}

test('an unavailable volume keeps catalogue facts and a retained explanation, without stale dataset controls', () => {
  const f = fixture('prepared-galaxy');
  f.card.set(f.record);
  assert.equal(f.unavailable.hidden, false);
  assert.match(f.unavailable.textContent, /3D view of Prepared galaxy is unavailable/);
  assert.equal(f.datasetTab.hidden, true);
  assert.equal(f.bank.hidden, true);
  assert.equal(f.root.querySelector('[data-focus-distance]')?.textContent, '50 kpc');
  f.card.set({ ...f.record, detailedObjectId: undefined });
  assert.equal(f.unavailable.hidden, true);
  f.card.set(f.record); f.card.set(null);
  assert.equal(f.unavailable.hidden, true);
  f.card.destroy();
});

test('prepared focus lenses retain controls and reflect only the applied runtime selection', () => {
  const f = fixture(), requested: string[] = [];
  f.presentation.selectLens = id => requested.push(id);
  f.card.set(f.record, [], f.presentation);
  assert.equal(f.bank.hidden, false);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(f.details.map(detail => detail.hidden), [false, true, true]);
  assert.equal(f.factsBank.hidden, false);
  assert.deepEqual(f.facts.map(detail => detail.hidden), [false, true, true]);
  f.buttons[1].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, ['second']);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true', 'Do not publish a lens before the runtime applies it');
  const retained = [...f.buttons, ...f.details];
  f.card.set(f.record, [], { ...f.presentation, selectedLens: 'second' });
  assert.deepEqual(f.buttons.map(button => button.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(f.details.map(detail => detail.hidden), [true, false, true]);
  assert.deepEqual(f.facts.map(detail => detail.hidden), [true, false, true]);
  assert.deepEqual([...f.bank.querySelectorAll('[data-focus-lens]'), ...f.bank.querySelectorAll('[data-focus-lens-details]')], retained);
  f.card.set(f.record, [], { ...f.presentation, selectedLens: 'third' });
  f.card.destroy();
  f.buttons[0].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, ['second']);
});

test('departed or unsupported galaxy focus hides its retained lens bank and disables stale actions', () => {
  const f = fixture(), requested: string[] = [];
  f.presentation.selectLens = id => requested.push(id);
  f.card.set(f.record, [], f.presentation);
  f.card.set({ ...f.record, detailedObjectId: 'image-galaxy' });
  assert.equal(f.bank.hidden, true);
  assert.equal(f.factsBank.hidden, true);
  f.buttons[1].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, []);
  f.card.set(f.record, [], f.presentation);
  assert.equal(f.bank.hidden, false);
  f.card.set(null);
  assert.equal(f.root.hidden, true);
  assert.equal(f.bank.hidden, true);
  f.buttons[2].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, []);
  f.card.destroy();
});

test('a nebula focus keeps classification out of the title and preserves the shared lens controls', () => {
  const f = fixture();
  const { membership: _membership, ...common } = f.record;
  f.card.set({ ...common, kind: 'nebula', detailedObjectId: 'prepared-galaxy',
    classification: { name: 'Emission nebula', basis: 'Conditional image reconstruction.', sourceRef: 'observations' } }, [], f.presentation);
  assert.equal(f.root.querySelector('[data-focus-status]')?.textContent, '');
  assert.equal(f.root.querySelector('[data-focus-status]')?.hidden, true);
  assert.equal(f.root.querySelector('[data-focus-membership]')?.textContent, 'Milky Way');
  assert.equal(f.root.querySelector('[data-focus-association]')?.textContent, 'Galactic nebula');
  assert.equal(f.bank.hidden, false);
  f.card.set(f.record, [], f.presentation);
  assert.equal(f.root.querySelector('[data-focus-status]')?.hidden, false, 'A later galaxy restores its status tag');
  f.card.destroy();
});

test('focus uses shared dataset tabs only when a prepared presentation is available', () => {
  const f = fixture();
  f.card.set(f.record);
  assert.equal(f.datasetTab.hidden, true);
  assert.deepEqual(f.tabs, ['factsheet']);
  f.card.set(f.record, [], f.presentation);
  assert.equal(f.datasetTab.hidden, false);
  assert.deepEqual(f.tabs, ['factsheet', 'dataset']);
  f.card.set(f.record, [], { ...f.presentation, selectedLens: 'second' });
  assert.deepEqual(f.tabs, ['factsheet', 'dataset'], 'Lens updates preserve the user’s current information tab');
  f.card.set({ ...f.record, id: 'catalogue:other', detailedObjectId: undefined });
  assert.equal(f.datasetTab.hidden, true);
  assert.deepEqual(f.tabs, ['factsheet', 'dataset', 'factsheet']);
  f.card.destroy();
});
