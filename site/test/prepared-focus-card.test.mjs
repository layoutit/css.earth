import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedFocusCard } from '../prepared-focus-card.mts';

class Element extends EventTarget {
  dataset = {}; selectors = new Map(); attributes = new Map(); hidden = false; checked = false; disabled = false; textContent = '';
  querySelector(selector) { return this.selectors.get(selector) ?? null; }
  querySelectorAll(selector) { return this.selectors.get(selector) ?? []; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
}
function fixture() {
  const root = new Element(), bank = new Element(), stars = new Element();
  bank.dataset.focusLensBank = 'prepared-galaxy';
  const ids = ['first', 'second', 'third'];
  const buttons = ids.map(id => Object.assign(new Element(), { value: id }));
  const details = ids.map(id => Object.assign(new Element(), { dataset: { focusLensDetails: id } }));
  bank.selectors.set('[data-focus-lens]', buttons);
  bank.selectors.set('[data-focus-lens-details]', details);
  bank.selectors.set('[data-focus-stars]', stars);
  root.selectors.set('[data-focus-lens-bank]', [bank]);
  for (const name of ['name', 'aliases', 'status', 'distance', 'uncertainty', 'membership', 'association', 'basis', 'reference']) {
    root.selectors.set(`[data-focus-${name}]`, new Element());
  }
  const record = { id: 'catalogue:galaxy', detailedObjectId: 'prepared-galaxy', name: 'Prepared galaxy', aliases: [], status: 'confirmed',
    distance: { valuePc: 50000, sourceRef: 'observations' }, membership: { group: 'local-group', subgroup: 'milky-way', basis: 'Published membership' } };
  const presentation = { objectId: 'prepared-galaxy', selectedLens: 'first', starsVisible: true,
    lenses: ids.map(id => ({ id })), selectLens() {}, setStarsVisible() {} };
  return { root, bank, stars, buttons, details, record, presentation, card: createPreparedFocusCard(root) };
}

test('prepared focus lenses retain controls and reflect only the applied runtime selection', () => {
  const f = fixture(), requested = [], starRequests = [];
  f.presentation.selectLens = id => requested.push(id);
  f.presentation.setStarsVisible = value => starRequests.push(value);
  f.card.set(f.record, [], f.presentation);
  assert.equal(f.bank.hidden, false);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(f.details.map(detail => detail.hidden), [false, true, true]);
  assert.equal(f.stars.checked, true);
  f.buttons[1].dispatchEvent(new Event('click'));
  assert.deepEqual(requested, ['second']);
  assert.equal(f.buttons[0].getAttribute('aria-pressed'), 'true', 'Do not publish a lens before the runtime applies it');
  const retained = [...f.buttons, ...f.details, f.stars];
  f.card.set(f.record, [], { ...f.presentation, selectedLens: 'second' });
  assert.deepEqual(f.buttons.map(button => button.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(f.details.map(detail => detail.hidden), [true, false, true]);
  assert.deepEqual([...f.bank.querySelectorAll('[data-focus-lens]'), ...f.bank.querySelectorAll('[data-focus-lens-details]'), f.bank.querySelector('[data-focus-stars]')], retained);
  f.stars.checked = false; f.stars.dispatchEvent(new Event('change'));
  assert.deepEqual(starRequests, [false]);
  f.card.set(f.record, [], { ...f.presentation, selectedLens: 'third', starsVisible: false });
  assert.equal(f.stars.checked, false);
  f.card.destroy();
  f.buttons[0].dispatchEvent(new Event('click'));
  f.stars.dispatchEvent(new Event('change'));
  assert.deepEqual(requested, ['second']);
  assert.deepEqual(starRequests, [false]);
});

test('departed or unsupported galaxy focus hides its retained lens bank and disables stale actions', () => {
  const f = fixture(), requested = [];
  f.presentation.selectLens = id => requested.push(id);
  f.card.set(f.record, [], f.presentation);
  f.card.set({ ...f.record, detailedObjectId: 'image-galaxy' });
  assert.equal(f.bank.hidden, true);
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
