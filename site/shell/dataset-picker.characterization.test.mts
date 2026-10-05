import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { sectionElements } from '@cssearth/renderer';
import { bindDatasetPicker, mountDatasetPickerLayout } from './dataset-picker.mts';
import type { BrowserWindow } from '../browser/browser-types.mts';
import { required } from '../test/navigation-test-values.mts';

const markup = `<html><body><div data-dataset-picker>
<div class="object-dataset-picker-display"><select data-dataset-native-select><option value="normal" selected>Color</option><option value="clouds">Clouds</option><option value="missing">Missing</option></select></div>
<div class="object-observation-controls"><button class="object-observation-control" value="normal"></button><button class="object-observation-control" value="clouds" disabled></button></div>
</div><select data-dataset-native-select><option selected value="normal">Detached</option></select><select><option selected value="normal">Unrelated</option></select><button id="other"></button></body></html>`;

test('layout swaps native display and retained rows, and destroy removes the media listener', () => {
  const { document, window } = parseHTML(markup);
  let matches = true;
  const media = new EventTarget();
  Object.defineProperty(media, 'matches', { get: () => matches });
  Object.defineProperty(window, 'matchMedia', { value: () => media, configurable: true });
  const layout = mountDatasetPickerLayout(document, window as BrowserWindow);
  const picker = required(document.querySelector<HTMLElement>('[data-dataset-picker]'));
  const display = required(sectionElements(picker, '.object-dataset-picker-display')[0]);
  const rows = required(sectionElements(picker, '.object-observation-controls')[0]);
  assert.equal(display.hidden, false); assert.equal(!display.closest('template'), true);
  assert.equal(rows.hidden, true); assert.equal(!rows.closest('template'), false);
  matches = false; media.dispatchEvent(new Event('change'));
  assert.equal(display.hidden, true); assert.equal(!display.closest('template'), false);
  assert.equal(rows.hidden, false); assert.equal(!rows.closest('template'), true);
  matches = true; media.dispatchEvent(new Event('change'));
  assert.equal(!display.closest('template'), true); assert.equal(!rows.closest('template'), false);
  layout.destroy(); matches = false; media.dispatchEvent(new Event('change'));
  assert.equal(!display.closest('template'), true); assert.equal(!rows.closest('template'), false);
});

test('native choices ignore disabled, absent and unrelated controls and stop forwarding on disposal', () => {
  const { document, window } = parseHTML(markup);
  const lifetime = createSceneLifetime(), selected: string[] = [];
  for (const button of document.querySelectorAll<HTMLButtonElement>('.object-observation-control')) button.click = () => { selected.push(button.getAttribute('value') ?? ''); };
  bindDatasetPicker(document, window as BrowserWindow, lifetime);
  const select = required(document.querySelector<HTMLSelectElement>('[data-dataset-picker] select'));
  function choose(value: string) {
    for (const option of select.querySelectorAll('option')) option.toggleAttribute('selected', option.getAttribute('value') === value);
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  choose('clouds'); choose('missing');
  for (const element of document.querySelectorAll('body > select, #other')) element.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual(selected, []);
  choose('normal'); assert.deepEqual(selected, ['normal']);
  lifetime.destroy(); choose('normal'); assert.deepEqual(selected, ['normal']);
});
