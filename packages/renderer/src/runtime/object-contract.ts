import { type DatasetVolume, type ObjectControls, requireObjectControls, objectCycleStates } from '@cssearth/objects';

export type ObjectAction = { readonly kind: 'dataset'; readonly id: string }
  | { readonly kind: 'toggle'; readonly name: string; readonly value: boolean }
  | { readonly kind: 'cycle'; readonly name: string; readonly value: number };
export interface ObjectSelection {
  readonly datasetId: string | null;
  readonly [name: string]: string | number | boolean | null;
}

/** The cloud a selected dataset turns on, if it names one. */
export function selectedDatasetVolume(controls: ObjectControls, datasetId: string | null): DatasetVolume | null {
  if (datasetId === null) return null;
  return (controls.datasets?.controls ?? []).find(dataset => dataset.id === datasetId)?.volume ?? null;
}

export function initialObjectSelection(controls: ObjectControls, datasetId?: string, settings?: unknown): ObjectSelection {
  requireObjectControls(controls);
  if (datasetId !== undefined) requireObjectAction(controls, { kind: 'dataset', id: datasetId });
  const selection: { datasetId: string | null; [name: string]: string | number | boolean | null } = { datasetId: datasetId ?? controls.datasets?.defaultDataset ?? null };
  for (const control of controls.settings?.controls ?? []) {
    if (control.kind === 'toggle') selection[control.name] = control.checked;
    else {
      const state = objectCycleStates(control).find(state => state.label === control.state);
      if (!state) throw new TypeError(`Cycle ${control.name} has no initial state.`);
      selection[control.name] = state.value;
    }
  }
  if (settings !== undefined) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new TypeError('Initial settings must be a record.');
    for (const [name, value] of Object.entries(settings)) {
      const control = controls.settings?.controls.find(control => control.name === name);
      if (!control || (control.kind === 'toggle' ? typeof value !== 'boolean' : typeof value !== 'number')) throw new TypeError(`Invalid initial setting: ${name}.`);
      requireObjectAction(controls, control.kind === 'toggle' ? { kind: 'toggle', name, value } : { kind: 'cycle', name, value });
      selection[name] = value;
    }
  }
  return Object.freeze(selection);
}

export function requireObjectAction(controls: ObjectControls, action: ObjectAction): ObjectAction {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new TypeError('Object action must be a record.');
  if (action.kind === 'dataset') {
    if (!(controls.datasets?.controls ?? []).some(dataset => dataset.id === action.id)) throw new RangeError(`Unknown object dataset: ${action.id}.`);
  } else {
    const control = (controls.settings?.controls ?? []).find(control => control.name === action.name);
    if (!control || control.kind !== action.kind || (control.kind === 'toggle' ? typeof action.value !== 'boolean'
      : !objectCycleStates(control).some(state => state.value === action.value))) throw new RangeError(`Unknown object control action: ${action.name}.`);
  }
  return Object.freeze({ ...action });
}

export function reduceObjectSelection(selection: ObjectSelection, action: ObjectAction): ObjectSelection {
  return Object.freeze(action.kind === 'dataset' ? { ...selection, datasetId: action.id } : { ...selection, [action.name]: action.value });
}
