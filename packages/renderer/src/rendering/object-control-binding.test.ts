import { afterEach, expect, test, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import { createObjectControlBinding, publishDatasetSelection } from './object-control-binding.js';
import type { ObjectSelectionState } from './object-selection-runtime.js';

test('a collapsed dataset preview follows the listed member of a selected sequence', () => {
  const document = parseHTML(`<section class="object-lenses">
    <span data-lens-selected="first"></span><span data-lens-selected="other" hidden></span>
    <select data-lens-native-select><option value="first" selected>First</option><option value="other">Other</option></select>
    <div data-lens-option data-step-group="sequence" data-step-listed="true"><button value="first" aria-pressed="true"></button></div>
    <div data-lens-option data-step-group="sequence" data-step-listed="false" hidden><button value="second" aria-pressed="false"></button></div>
    <div data-lens-option><button value="other" aria-pressed="false"></button></div>
    <div data-lens-details="first"></div><div data-lens-details="second" hidden></div><div data-lens-details="other" hidden></div>
  </section>`).document;
  const root = document.querySelector<HTMLElement>('.object-lenses')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const details = [...root.querySelectorAll<HTMLElement>('[data-lens-details]')]
    .map(panel => ({ id: panel.dataset.lensDetails!, panel }));
  const selected = () => [...root.querySelectorAll<HTMLElement>('[data-lens-selected]')]
    .filter(preview => !preview.hidden).map(preview => preview.dataset.lensSelected);

  publishDatasetSelection(buttons, details, [], new Set(['second']), root);
  expect(selected()).toEqual(['first']);
  expect(root.querySelector<HTMLSelectElement>('select')?.value).toBe('first');
  expect(details.map(({ panel }) => panel.hidden)).toEqual([true, false, true]);

  publishDatasetSelection(buttons, details, [], new Set(['other']), root);
  expect(selected()).toEqual(['other']);
  expect(root.querySelector<HTMLSelectElement>('select')?.value).toBe('other');
  expect(details.map(({ panel }) => panel.hidden)).toEqual([true, true, false]);
});

afterEach(() => vi.useRealTimers());

function sequence(autoplay = true) {
  const ids = ['first', 'last', 'other'];
  const { document, Event } = parseHTML(`<main></main><section class="object-information-panel"><div class="object-lenses">
    <form data-dataset-form>${ids.map(id => `<div data-lens-option ${id !== 'other' ? `data-step-group="dates" data-step-autoplay="${autoplay}"` : ''}>
      <button type="submit" name="dataset" value="${id}" aria-controls="details-${id}">${id}</button></div>`).join('')}</form></div>
    ${ids.map(id => `<div id="details-${id}" data-lens-details="${id}">${id !== 'other' ?
      '<div data-sequence-player><button type="button" data-dataset-play="dates" disabled></button></div>' : ''}</div>`).join('')}
    </section>`);
  const form = document.querySelector('form')!;
  // Linkedom does not implement form.elements or button.value.
  for (const button of form.querySelectorAll('button')) button.value = button.getAttribute('value')!;
  Object.defineProperty(form, 'elements', { value: [...form.querySelectorAll('button')] });
  let state: ObjectSelectionState = { desired: { lensId: 'last' }, committed: { lensId: 'last' }, committedBy: null,
    plan: null, pending: false, loadingMaterial: false, ready: true, error: null, viewRevision: null };
  const actions: string[] = [];
  const binding = createObjectControlBinding({ stage: document.querySelector('main')!,
    controls: { lenses: { defaultLens: 'last', controls: ids.map(id => ({ id, label: id })) }, settings: null },
    initialSelection: state.desired, getState: () => state,
    onAction(action) {
      if (action.kind !== 'lens') throw new Error('Expected a dataset action');
      actions.push(action.id);
      state = { ...state, desired: { lensId: action.id }, pending: true };
      binding.publish();
    }, onError: error => { throw error; } });
  binding.setReady();
  const click = (selector: string) => document.querySelector(selector)!.dispatchEvent(new Event('click', { cancelable: true }));
  return { binding, document, actions, click,
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
