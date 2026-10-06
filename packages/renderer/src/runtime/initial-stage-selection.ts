import { type ObjectControls } from '@cssearth/objects';

import { initialObjectSelection } from './object-contract.js';

import { sectionElements } from '../rendering/dom/detached-sections.js';

/** Preparation and attachment read the same transported selection and live controls. */
export function initialStageSelection(controls: ObjectControls, stage: HTMLElement) {
  const dataset = stage.dataset.preparedDataset;
  if (stage.dataset.preparedSettings) initialObjectSelection(controls, dataset, JSON.parse(stage.dataset.preparedSettings));
  const settings: Record<string, boolean | number> = {};
  // The settings panel may wait off the page while it is closed (detached-sections.ts).
  const inputs = sectionElements(stage.ownerDocument, '.object-settings').flatMap(root => [...root.querySelectorAll<HTMLInputElement>('input[form][name]')]);
  for (const control of controls.settings?.controls ?? []) {
    const input = inputs.find(input => input.name === control.name);
    if (input) settings[control.name] = control.kind === 'toggle' ? input.checked : Number(input.value);
  }
  return { initialDataset: dataset, initialSettings: settings, selection: initialObjectSelection(controls, dataset, settings) };
}
