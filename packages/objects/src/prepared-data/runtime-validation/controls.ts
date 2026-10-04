import { SHELL_SETTING_NAMES, objectCycleStates, type ObjectControls } from '../runtime/object-controls.js';
import { array, boolean, choice, fail, finite, record, text, unique } from './guards.js';
export function requireControls(value: unknown): asserts value is ObjectControls {
  const controls = record(value, 'controls');
  if (controls.datasets !== null) {
    const datasets = record(controls.datasets, 'datasets');
    const ids = array(datasets.controls, 'dataset controls').map(input => {
      const dataset = record(input, 'dataset'); text(dataset.label, 'dataset label'); return text(dataset.id, 'dataset id');
    });
    unique(ids, 'datasets');
    if (!ids.includes(text(datasets.defaultDataset, 'default dataset'))) fail('default dataset must be declared');
  }
  if (controls.settings !== null) {
    const settings = record(controls.settings, 'settings'), names: string[] = [];
    for (const input of array(settings.controls, 'setting controls')) {
      const setting = record(input, 'setting'), name = text(setting.name, 'setting name'); names.push(name);
      if (SHELL_SETTING_NAMES.has(name)) fail(`setting ${name} belongs to the shared shell`);
      const label = text(setting.label, 'setting label'), kind = choice(setting.kind, ['cycle', 'toggle'], 'setting kind');
      if (kind === 'toggle') boolean(setting.checked, 'toggle default');
      else {
        const state = text(setting.state, 'cycle default');
        const states = setting.states === undefined ? undefined : array(setting.states, 'cycle states').map(item => {
          const entry = record(item, 'cycle state'); return {label: text(entry.label, 'cycle label'), value: finite(entry.value, 'cycle value')};
        });
        objectCycleStates({kind, name, label, state, ...(states === undefined ? {} : {states})});
      }
    }
    unique(names, 'settings');
  }
}
