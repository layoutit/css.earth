import { expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { publishDatasetSelection } from './object-control-binding.js';

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
