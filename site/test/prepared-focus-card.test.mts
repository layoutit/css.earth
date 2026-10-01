import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { createPreparedFocusCard } from '../prepared-focus-card.mts';
import type { FocusObject, PreparedFocusPresentation } from '../prepared-focus.mts';

class Element extends EventTarget {
  dataset: Record<string, string> = {}; selectors = new Map<string, Element | Element[]>(); attributes = new Map<string, string>(); hidden = false; checked = false; disabled = false; textContent = '';
  querySelector(selector: string) { const value = this.selectors.get(selector); return value instanceof Element ? value : null; }
  // A selector list answers each of its parts, as the card's detached-section lookups ask (detached-sections.ts).
  querySelectorAll(selector: string): Element[] {
    const own = selector.replace(', template[data-detached-section]', ''), whole = this.selectors.get(own);
    if (whole !== undefined) return Array.isArray(whole) ? whole : [whole];
    return own.split(', ').flatMap(part => { const value = this.selectors.get(part); return Array.isArray(value) ? value : value instanceof Element ? [value] : []; });
  }
  matches() { return true; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
function fixture(unavailableObjects = '', { banksLater = false } = {}) {
  const root = new Element(), bank = new Element(), datasetTab = new Element();
  const tabs: string[] = [];
  root.selectors.set('[data-information-tab="dataset"]', datasetTab);
  const unavailable = new Element(); unavailable.dataset.unavailableObjects = unavailableObjects;
  root.selectors.set('[data-focus-unavailable]', unavailable);
  bank.dataset.focusDatasetBank = 'prepared-galaxy';
  const ids = ['first', 'second', 'third'];
  const buttons = ids.map(id => { const button = new Element(); button.setAttribute('value', id); return button; });
  const details = ids.map(id => Object.assign(new Element(), { dataset: { focusDatasetDetails: id } }));
  bank.selectors.set('[data-focus-dataset]', buttons);
  bank.selectors.set('[data-focus-dataset-details]', details);
  const factsBank = new Element(); factsBank.dataset.focusFactsBank = 'prepared-galaxy';
  const facts = ids.map(id => Object.assign(new Element(), { dataset: { focusDatasetDetails: id }, textContent: 'Source pixels 2048 × 4096' }));
  factsBank.selectors.set('[data-focus-dataset-details]', facts);
  const spliceBanks = () => root.selectors.set('[data-focus-dataset-bank], [data-focus-facts-bank]', [bank, factsBank]);
  if (!banksLater) spliceBanks();
  for (const name of ['name', 'aliases', 'introduction', 'status']) {
    root.selectors.set(`[data-focus-${name}]`, new Element());
  }
  root.selectors.set('[data-focus-aliases-row]', new Element());
  root.selectors.set('[data-focus-learn-more]', new Element());
  // The registry object the card presents: its id is its package's, so its banks are found by it.
  const record: FocusObject = { id: 'prepared-galaxy', name: 'Prepared galaxy', description: 'A galaxy 50,000 parsecs away.', aliases: [], classification: 'galaxy',
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [0, 0, 1e21], presentationToReference: [0, 1, 0, 1, 0, 0, 0, 0, 1], metersPerUnit: 1e20, bodyRadiusM: 1e20 } };
  const presentation: PreparedFocusPresentation = { id: 'first', defaultDataset: 'first', objectId: 'prepared-galaxy', selectedDataset: 'first', starsVisible: true,
    datasets: ids.map(id => ({ id, label: id, title: id, description: id, sourceUrl: 'https://example.test/source' })), selectDataset() {} };
  // This retained DOM stand-in implements only the card's queried fields and events.
  return { root, bank, factsBank, spliceBanks, facts, buttons, details, record, presentation, datasetTab, tabs, unavailable,
    card: createPreparedFocusCard(root as unknown as HTMLElement, id => tabs.push(id)) };
}

test('an unavailable volume keeps its facts and a retained explanation, without stale dataset controls', () => {
  const f = fixture('prepared-galaxy');
  f.card.set(f.record);
  assert.equal(f.unavailable.hidden, false);
  assert.match(f.unavailable.textContent, /3D view of Prepared galaxy is unavailable/);
  assert.equal(f.datasetTab.hidden, true);
  assert.equal(f.bank.hidden, true);
  assert.equal(f.root.querySelector('[data-focus-introduction]')?.textContent, 'A galaxy 50,000 parsecs away.');
  f.card.set({ ...f.record, id: 'other-galaxy' });
  assert.equal(f.unavailable.hidden, true);
  f.card.set(f.record); f.card.set(null);
  assert.equal(f.unavailable.hidden, true);
  f.card.destroy();
});

test('prepared focus datasets retain controls and reflect only the applied runtime selection', () => {
  const f = fixture(), requested: string[] = [];
  f.presentation.selectDataset = id => requested.push(id);
  f.card.set(f.record, f.presentation);
  assert.equal(f.bank.hidden, false);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(f.details.map(detail => detail.hidden), [false, true, true]);
  assert.equal(f.factsBank.hidden, false);
  assert.deepEqual(f.facts.map(detail => detail.hidden), [false, true, true]);
  f.buttons[1].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, ['second']);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true', 'Do not publish a dataset before the runtime applies it');
  const retained = [...f.buttons, ...f.details];
  f.card.set(f.record, { ...f.presentation, selectedDataset: 'second' });
  assert.deepEqual(f.buttons.map(button => button.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(f.details.map(detail => detail.hidden), [true, false, true]);
  assert.deepEqual(f.facts.map(detail => detail.hidden), [true, false, true]);
  assert.deepEqual([...f.bank.querySelectorAll('[data-focus-dataset]'), ...f.bank.querySelectorAll('[data-focus-dataset-details]')], retained);
  f.card.set(f.record, { ...f.presentation, selectedDataset: 'third' });
  f.card.destroy();
  f.buttons[0].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, ['second']);
});

test('departed or unsupported galaxy focus hides its retained dataset bank and disables stale actions', () => {
  const f = fixture(), requested: string[] = [];
  f.presentation.selectDataset = id => requested.push(id);
  f.card.set(f.record, f.presentation);
  f.card.set({ ...f.record, id: 'image-galaxy' });
  assert.equal(f.bank.hidden, true);
  assert.equal(f.factsBank.hidden, true);
  f.buttons[1].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, []);
  f.card.set(f.record, f.presentation);
  assert.equal(f.bank.hidden, false);
  f.card.set(null);
  assert.equal(f.root.hidden, false, 'the selection presentation owns the card\'s visibility');
  assert.equal(f.bank.hidden, true);
  f.buttons[2].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, []);
  f.card.destroy();
});

test('a nebula or globular-cluster focus keeps classification out of the title and preserves the shared dataset controls', () => {
  for (const classification of ['nebula', 'globular-cluster'] as const) {
    const f = fixture();
    f.card.set({ ...f.record, classification, aliases: ['Example 1'], description: 'A source-backed introduction.' }, f.presentation);
    assert.equal(f.root.querySelector('[data-focus-introduction]')?.textContent, 'A source-backed introduction.');
    assert.equal(f.root.querySelector('[data-focus-aliases]')?.textContent, 'Example 1');
    assert.equal(f.root.querySelector('[data-focus-aliases-row]')?.hidden, false);
    assert.equal(f.root.querySelector('[data-focus-status]')?.textContent, '');
    assert.equal(f.root.querySelector('[data-focus-status]')?.hidden, true);
    assert.equal(f.bank.hidden, false);
    assert.equal(f.datasetTab.hidden, false);
    f.card.set(f.record, f.presentation);
    assert.equal(f.root.querySelector('[data-focus-status]')?.hidden, false, 'A later galaxy restores its type tag');
    assert.equal(f.root.querySelector('[data-focus-status]')?.textContent, 'Galaxy');
    f.card.destroy();
  }
});

test('focus uses shared dataset tabs only when a prepared presentation is available', () => {
  const f = fixture();
  f.card.set(f.record);
  assert.equal(f.datasetTab.hidden, true);
  assert.deepEqual(f.tabs, ['factsheet']);
  f.card.set(f.record, f.presentation);
  assert.equal(f.datasetTab.hidden, false);
  assert.deepEqual(f.tabs, ['factsheet', 'dataset']);
  f.card.set(f.record, { ...f.presentation, selectedDataset: 'second' });
  assert.deepEqual(f.tabs, ['factsheet', 'dataset'], 'Dataset updates preserve the user’s current information tab');
  f.card.set({ ...f.record, id: 'other-galaxy' });
  assert.equal(f.datasetTab.hidden, true);
  assert.deepEqual(f.tabs, ['factsheet', 'dataset', 'factsheet']);
  f.card.destroy();
});

test('banks spliced after a focus is presented are adopted and show the current selection', () => {
  const f = fixture('', { banksLater: true }), requested: string[] = [];
  f.presentation.selectDataset = id => requested.push(id);
  f.card.set(f.record, { ...f.presentation, selectedDataset: 'second' });
  // Spliced banks arrive hidden, as the fragment renders them.
  f.bank.hidden = true; f.factsBank.hidden = true;
  f.spliceBanks();
  f.card.adoptBanks();
  assert.equal(f.bank.hidden, false);
  assert.deepEqual(f.buttons.map(button => button.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(f.facts.map(detail => detail.hidden), [true, false, true]);
  f.card.adoptBanks();
  f.buttons[2].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, ['third'], 'Adopting twice binds each control once');
  f.card.destroy();
});


test('Wikipedia follows the selected focus without replacing the retained link', () => {
  const f = fixture();
  const link = f.root.querySelector('[data-focus-learn-more]')!;
  f.card.set({ ...f.record, aliases: ['Example'] });
  assert.equal(link.hidden, false);
  assert.equal(new URL(link.getAttribute('href')!).searchParams.get('search'), 'Prepared galaxy');
  f.card.set({ ...f.record, name: 'Another galaxy', aliases: ['Other'] });
  assert.equal(f.root.querySelector('[data-focus-learn-more]'), link);
  assert.equal(new URL(link.getAttribute('href')!).searchParams.get('search'), 'Another galaxy');
  f.card.set(null);
  assert.equal(link.hidden, true);
  f.card.destroy();
});
