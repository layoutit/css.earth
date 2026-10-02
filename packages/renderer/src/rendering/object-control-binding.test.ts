import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createObjectControlBinding, publishDatasetPreview, publishDatasetSelection } from './object-control-binding.js';
import type { ObjectSelectionState } from './object-selection-runtime.js';
import { showSection } from './detached-sections.js';

test('the native select takes the committed dataset while a wide layout keeps it off the page', () => {
  const document = parseHTML(`<section class="object-datasets">
    <div class="object-dataset-picker-display"><select data-dataset-native-select><option value="first" selected>First</option><option value="other">Other</option></select></div>
    <div data-dataset-option><button value="first" aria-pressed="false"></button></div>
    <div data-dataset-option><button value="other" aria-pressed="true"></button></div>
  </section>`).document;
  const root = document.querySelector<HTMLElement>('.object-datasets')!, display = root.querySelector<HTMLElement>('.object-dataset-picker-display')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  showSection(display, false);
  assert.equal(root.querySelector('select'), null);
  publishDatasetPreview(root, buttons);
  showSection(display, true);
  assert.deepEqual([...root.querySelectorAll('option')].filter(option => option.hasAttribute('selected')).map(option => option.value), ['other']);
});

test('a collapsed dataset preview follows the listed member of a selected sequence', () => {
  const document = parseHTML(`<section class="object-datasets">
    <span data-dataset-selected="first"></span><span data-dataset-selected="other" hidden></span>
    <select data-dataset-native-select><option value="first" selected>First</option><option value="other">Other</option></select>
    <div data-dataset-option data-step-group="sequence" data-step-listed="true"><button value="first" aria-pressed="true"></button></div>
    <div data-dataset-option data-step-group="sequence" data-step-listed="false" hidden><button value="second" aria-pressed="false"></button></div>
    <div data-dataset-option><button value="other" aria-pressed="false"></button></div>
    <div data-dataset-details="first"></div><div data-dataset-details="second" hidden></div><div data-dataset-details="other" hidden></div>
  </section>`).document;
  const root = document.querySelector<HTMLElement>('.object-datasets')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const details = [...root.querySelectorAll<HTMLElement>('[data-dataset-details]')]
    .map(panel => ({ id: panel.dataset.datasetDetails!, panel }));
  const selected = () => [...root.querySelectorAll<HTMLElement>('[data-dataset-selected]')]
    .filter(preview => !preview.hidden).map(preview => preview.dataset.datasetSelected);

  publishDatasetSelection(buttons, details, [], new Set(['second']), root);
  assert.deepEqual(selected(), ['first']);
  assert.equal(root.querySelector<HTMLSelectElement>('select')?.value, 'first');
  // Only the active dataset's details are mounted; the others wait in templates (detached-sections.ts).
  assert.deepEqual(details.map(({ panel }) => panel.isConnected && !panel.closest('template')), [false, true, false]);

  publishDatasetSelection(buttons, details, [], new Set(['other']), root);
  assert.deepEqual(selected(), ['other']);
  assert.equal(root.querySelector<HTMLSelectElement>('select')?.value, 'other');
  assert.deepEqual(details.map(({ panel }) => panel.isConnected && !panel.closest('template')), [false, false, true]);
});

afterEach(() => mock.timers.reset());

function sequence(autoplay = true) {
  const ids = ['first', 'last', 'other'];
  const { document, Event } = parseHTML(`<main></main><section class="object-information-panel"><div class="object-datasets">
    <form data-dataset-form>${ids.map(id => `<div data-dataset-option ${id !== 'other' ? `data-step-group="dates" data-step-autoplay="${autoplay}"` : ''}>
      <button type="submit" name="dataset" value="${id}" aria-controls="details-${id}">${id}</button></div>`).join('')}</form></div>
    ${ids.map(id => `<div id="details-${id}" data-dataset-details="${id}">${id !== 'other' ?
      '<div data-sequence-player><button type="button" data-dataset-play="dates" disabled></button></div>' : ''}</div>`).join('')}
    </section>`);
  const form = document.querySelector('form')!;
  // Linkedom does not implement form.elements or button.value.
  for (const button of form.querySelectorAll('button')) button.value = button.getAttribute('value')!;
  Object.defineProperty(form, 'elements', { value: [...form.querySelectorAll('button')] });
  let state: ObjectSelectionState = { desired: { datasetId: 'last' }, committed: { datasetId: 'last' }, committedBy: null,
    plan: null, pending: false, loadingMaterial: false, ready: true, error: null, viewRevision: null };
  const actions: string[] = [], framed: boolean[] = [];
  const binding = createObjectControlBinding({ stage: document.querySelector('main')!,
    controls: { datasets: { defaultDataset: 'last', controls: ids.map(id => ({ id, label: id })) }, settings: null },
    initialSelection: state.desired, getState: () => state,
    onAction(action, options) {
      if (action.kind !== 'dataset') throw new Error('Expected a dataset action');
      actions.push(action.id); framed.push(options?.frameCamera ?? true);
      state = { ...state, desired: { datasetId: action.id }, pending: true };
      binding.publish();
    }, onError: error => { throw error; } });
  binding.setReady();
  const click = (selector: string) => document.querySelector(selector)!.dispatchEvent(new Event('click', { cancelable: true }));
  return { binding, document, actions, framed, click,
    commit() { state = { ...state, committed: state.desired, pending: false }; binding.publish(); },
    hide() { Object.defineProperty(document, 'hidden', { value: true }); document.dispatchEvent(new Event('visibilitychange')); } };
}

test('sequence playback wraps, waits for the pending map, and pauses without another selection', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'setImmediate', 'Date'] });
  const h = sequence();
  assert.equal(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed'), 'false');
  h.click('#details-last [data-dataset-play]');
  assert.equal(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed'), 'true');
  // The on-screen step's fill runs with its hold.
  assert.equal(h.document.querySelector('#details-last [data-sequence-player]')?.getAttribute('data-sequence-running'), 'true');
  mock.timers.tick(1500);
  assert.deepEqual(h.actions, ['first']);
  mock.timers.tick(10000);
  assert.deepEqual(h.actions, ['first']);
  h.commit();
  mock.timers.tick(1499);
  assert.deepEqual(h.actions, ['first']);
  mock.timers.tick(1);
  assert.deepEqual(h.actions, ['first', 'last']);
  h.commit();
  h.click('#details-last [data-dataset-play]');
  mock.timers.tick(10000);
  assert.deepEqual(h.actions, ['first', 'last']);
  assert.equal(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed'), 'false');
  assert.equal(h.document.querySelector('#details-last [data-sequence-player]')?.getAttribute('data-sequence-running'), 'false');
  h.binding.publish();
  h.click('[value="other"]'); h.commit();
  h.click('[value="last"]'); h.commit();
  mock.timers.tick(1500);
  assert.deepEqual(h.actions, ['first', 'last', 'other', 'last']);
  h.binding.destroy();
});

test('a chosen dataset shows its load on its row until it commits', () => {
  const h = sequence();
  const busy = (selector: string) => h.document.querySelector(selector)?.getAttribute('aria-busy');
  const root = h.document.querySelector('.object-datasets');
  assert.equal(busy('[value="other"]'), 'false');
  h.click('[value="other"]');
  assert.equal(busy('[value="other"]'), 'true');
  assert.equal(root?.getAttribute('data-dataset-loading'), 'true');
  h.commit();
  assert.equal(busy('[value="other"]'), 'false');
  assert.equal(root?.getAttribute('data-dataset-loading'), 'false');
  h.binding.destroy();
});

for (const autoplay of [true, false]) test(`a sequence stays paused even with legacy autoplay=${autoplay} until Play is pressed`, () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'setImmediate', 'Date'] });
  const h = sequence(autoplay);
  mock.timers.tick(10000);
  assert.deepEqual(h.actions, []);
  assert.equal(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed'), 'false');
  h.click('#details-last [data-dataset-play]');
  mock.timers.tick(1500);
  assert.deepEqual(h.actions, ['first']);
  h.commit();
  h.click('[value="other"]'); h.commit();
  h.click('[value="last"]'); h.commit();
  mock.timers.tick(10000);
  assert.deepEqual(h.actions, ['first', 'other', 'last']);
  h.binding.destroy();
});

for (const reason of ['manual', 'hidden', 'unready', 'destroy'] as const) test(`playback stops on ${reason}`, () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'setImmediate', 'Date'] });
  const h = sequence();
  h.click('#details-last [data-dataset-play]');
  if (reason === 'manual') { h.click('[value="other"]'); h.commit(); }
  if (reason === 'hidden') h.hide();
  if (reason === 'unready') h.binding.setReady(false);
  if (reason === 'destroy') h.binding.destroy();
  const actions = [...h.actions];
  mock.timers.tick(10000);
  assert.deepEqual(h.actions, actions);
  h.binding.destroy();
});

test('stepping within the sequence on screen keeps the reader\'s camera; entering or leaving it frames the data', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'setImmediate', 'Date'] });
  const h = sequence();
  h.click('#details-last [data-dataset-play]');
  mock.timers.tick(1500); h.commit();
  h.click('#details-first [data-dataset-play]');
  h.click('[value="other"]'); h.commit();
  h.click('[value="last"]'); h.commit();
  assert.deepEqual(h.actions, ['first', 'other', 'last']);
  assert.deepEqual(h.framed, [false, true, true]);
  h.binding.destroy();
});
