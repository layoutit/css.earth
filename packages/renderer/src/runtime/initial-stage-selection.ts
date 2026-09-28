import { initialObjectSelection, type ObjectControls } from './object-contract.js';

/** Preparation and attachment read the same transported selection and live controls. */
export function initialStageSelection(controls: ObjectControls, stage: HTMLElement) {
  const lens = stage.dataset.preparedDataset;
  if (stage.dataset.preparedSettings) initialObjectSelection(controls, lens, JSON.parse(stage.dataset.preparedSettings));
  const settings: Record<string, boolean | number> = {};
  const inputs = [...stage.ownerDocument.querySelectorAll<HTMLInputElement>('.object-settings input[form][name]')];
  for (const control of controls.settings?.controls ?? []) {
    const input = inputs.find(input => input.name === control.name);
    if (input) settings[control.name] = control.kind === 'toggle' ? input.checked : Number(input.value);
  }
  return { initialLens: lens, initialSettings: settings, selection: initialObjectSelection(controls, lens, settings) };
}
