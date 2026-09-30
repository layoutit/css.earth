import { afterEach, expect, test, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import { createObjectControlBinding, publishDatasetSelection } from './object-control-binding.js';
import type { ObjectSelectionState } from './object-selection-runtime.js';

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
  expect(selected()).toEqual(['first']);
  expect(root.querySelector<HTMLSelectElement>('select')?.value).toBe('first');
  // Only the active dataset's details are mounted; the others wait in templates (detached-sections.ts).
  expect(details.map(({ panel }) => panel.isConnected && !panel.closest('template'))).toEqual([false, true, false]);

  publishDatasetSelection(buttons, details, [], new Set(['other']), root);
  expect(selected()).toEqual(['other']);
  expect(root.querySelector<HTMLSelectElement>('select')?.value).toBe('other');
  expect(details.map(({ panel }) => panel.isConnected && !panel.closest('template'))).toEqual([false, false, true]);
});

afterEach(() => vi.useRealTimers());

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
  vi.useFakeTimers();
  const h = sequence();
  expect(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed')).toBe('false');
  h.click('#details-last [data-dataset-play]');
  expect(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed')).toBe('true');
  // The on-screen step's fill runs with its hold.
  expect(h.document.querySelector('#details-last [data-sequence-player]')?.getAttribute('data-sequence-running')).toBe('true');
  vi.advanceTimersByTime(1500);
  expect(h.actions).toEqual(['first']);
  vi.advanceTimersByTime(10000);
  expect(h.actions).toEqual(['first']);
  h.commit();
  vi.advanceTimersByTime(1499);
  expect(h.actions).toEqual(['first']);
  vi.advanceTimersByTime(1);
  expect(h.actions).toEqual(['first', 'last']);
  h.commit();
  h.click('#details-last [data-dataset-play]');
  vi.advanceTimersByTime(10000);
  expect(h.actions).toEqual(['first', 'last']);
  expect(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed')).toBe('false');
  expect(h.document.querySelector('#details-last [data-sequence-player]')?.getAttribute('data-sequence-running')).toBe('false');
  h.binding.publish();
  expect(vi.getTimerCount()).toBe(0);
  h.click('[value="other"]'); h.commit();
  h.click('[value="last"]'); h.commit();
  vi.advanceTimersByTime(1500);
  expect(h.actions).toEqual(['first', 'last', 'other', 'last']);
  expect(vi.getTimerCount()).toBe(0);
  h.binding.destroy();
});

test.each([true, false])('a sequence stays paused even with legacy autoplay=%s until Play is pressed', autoplay => {
  vi.useFakeTimers();
  const h = sequence(autoplay);
  vi.advanceTimersByTime(10000);
  expect(h.actions).toEqual([]);
  expect(h.document.querySelector('[data-dataset-play]')?.getAttribute('aria-pressed')).toBe('false');
  h.click('#details-last [data-dataset-play]');
  vi.advanceTimersByTime(1500);
  expect(h.actions).toEqual(['first']);
  h.commit();
  h.click('[value="other"]'); h.commit();
  h.click('[value="last"]'); h.commit();
  vi.advanceTimersByTime(10000);
  expect(h.actions).toEqual(['first', 'other', 'last']);
  h.binding.destroy();
});

test.each(['manual', 'hidden', 'unready', 'destroy'] as const)('playback stops on %s', reason => {
  vi.useFakeTimers();
  const h = sequence();
  h.click('#details-last [data-dataset-play]');
  if (reason === 'manual') { h.click('[value="other"]'); h.commit(); }
  if (reason === 'hidden') h.hide();
  if (reason === 'unready') h.binding.setReady(false);
  if (reason === 'destroy') h.binding.destroy();
  const actions = [...h.actions];
  vi.advanceTimersByTime(10000);
  expect(h.actions).toEqual(actions);
  expect(vi.getTimerCount()).toBe(0);
  h.binding.destroy();
});

test('stepping within the sequence on screen keeps the reader\'s camera; entering or leaving it frames the data', () => {
  vi.useFakeTimers();
  const h = sequence();
  h.click('#details-last [data-dataset-play]');
  vi.advanceTimersByTime(1500); h.commit();
  h.click('#details-first [data-dataset-play]');
  h.click('[value="other"]'); h.commit();
  h.click('[value="last"]'); h.commit();
  expect(h.actions).toEqual(['first', 'other', 'last']);
  expect(h.framed).toEqual([false, true, true]);
  h.binding.destroy();
});
