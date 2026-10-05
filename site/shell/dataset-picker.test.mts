import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { sourceTest } from '@cssearth/objects/node/source-test';
import type { BrowserWindow } from '../browser/browser-types.mts';
import { bindDatasetPicker } from './dataset-picker.mts';

const test = sourceTest();

test('the native dataset select activates its matching retained control', () => {
  const { document, window } = parseHTML(`<div data-dataset-picker>
    <select data-dataset-native-select><option value="normal">Visible color</option><option value="clouds">Cloud coverage</option></select>
    <button class="object-observation-control" value="normal"></button>
    <button class="object-observation-control" value="clouds"></button>
  </div>`);
  const select = document.querySelector<HTMLSelectElement>('select');
  assert.ok(select);
  const selections: string[] = [];
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    button.click = () => { selections.push(button.getAttribute('value') ?? ''); };
  }
  const lifetime = createSceneLifetime();
  bindDatasetPicker(document, window as BrowserWindow, lifetime);
  select.querySelector('option[value="normal"]')?.removeAttribute('selected');
  select.querySelector('option[value="clouds"]')?.setAttribute('selected', '');
  assert.equal(select.value, 'clouds');
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.deepEqual(selections, ['clouds']);
  lifetime.destroy();
});
