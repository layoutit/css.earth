import { SHELL_SETTING_NAMES } from './shell-settings.js';
import { OBJECT_SPEED_STATES } from '../rendering/object-feature-controls.js';

export const OBJECT_RUNTIME_SCHEMA = 'cssearth-object-runtime@5';

/** A companion cloud this body owns. A dataset control that names one keeps a prepared surface and turns the cloud on;
 * the shell drives the cloud, and the object's own presentation never learns about it. */
export interface DatasetVolume {
  readonly objectId: string;
  readonly datasetId: string;
  /** The prepared surface dataset this control keeps. It must name another control that has one. */
  readonly surface: string;
}
export interface DatasetControl {
  readonly id: string;
  readonly label: string;
  readonly volume?: DatasetVolume;
  readonly [key: string]: unknown;
}
export interface CycleState { readonly label: string; readonly value: number }
export interface ToggleControl {
  readonly kind: 'toggle'; readonly name: string; readonly label: string; readonly checked: boolean;
}
export interface CycleControl {
  readonly kind: 'cycle'; readonly name: string; readonly label: string; readonly state: string;
  readonly states?: readonly CycleState[];
}
export type SettingControl = ToggleControl | CycleControl;
export interface ObjectControls {
  readonly datasets: { readonly defaultDataset: string; readonly controls: readonly DatasetControl[]; readonly [key: string]: unknown } | null;
  readonly settings: { readonly controls: readonly SettingControl[]; readonly [key: string]: unknown } | null;
}
export type ObjectAction = { readonly kind: 'dataset'; readonly id: string }
  | { readonly kind: 'toggle'; readonly name: string; readonly value: boolean }
  | { readonly kind: 'cycle'; readonly name: string; readonly value: number };
export interface ObjectSelection {
  readonly datasetId: string | null;
  readonly [name: string]: string | number | boolean | null;
}

const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export function requireObjectControls(content: ObjectControls, objectId = 'unknown'): ObjectControls {
  if (!content || typeof content !== 'object' || !Object.hasOwn(content, 'datasets') || !Object.hasOwn(content, 'settings')) {
    throw new TypeError(`Object ${objectId} must export its datasets and settings content.`);
  }
  for (const name of ['datasets', 'settings'] as const) {
    if (content[name] != null && !Array.isArray(content[name]?.controls)) {
      throw new TypeError(`Object ${objectId} ${name} controls must be an array.`);
    }
  }
  const datasetControls = content.datasets?.controls ?? [], datasetIds = datasetControls.map(dataset => dataset.id);
  if (datasetIds.some(id => !nonempty(id)) || new Set(datasetIds).size !== datasetIds.length ||
      (datasetIds.length && !datasetIds.includes(content.datasets!.defaultDataset))) {
    throw new TypeError(`Object ${objectId} dataset IDs/default are invalid.`);
  }
  // A cloud dataset borrows a prepared surface; the surface it borrows must itself be prepared, so the chain is one deep.
  // A dataset may name a cloud and still own its surface, which is what a dataset whose own observation continues
  // beyond the body does: it borrows itself.
  const surfaceIds = datasetControls.filter(dataset => dataset.volume === undefined || dataset.volume.surface === dataset.id).map(dataset => dataset.id);
  for (const dataset of datasetControls) {
    if (dataset.volume === undefined) continue;
    const volume = dataset.volume;
    if (!volume || typeof volume !== 'object' || !nonempty(volume.objectId) || !nonempty(volume.datasetId) || !surfaceIds.includes(volume.surface)) {
      throw new TypeError(`Object ${objectId} dataset ${dataset.id} must name a cloud object, its dataset and a prepared surface dataset.`);
    }
  }
  if (datasetControls.length && !surfaceIds.length) throw new TypeError(`Object ${objectId} has no prepared surface dataset.`);
  const settings = content.settings?.controls ?? [], names = settings.map(setting => setting.name);
  if (names.some(name => !nonempty(name) || SHELL_SETTING_NAMES.has(name)) || new Set(names).size !== names.length ||
      settings.some(setting => !['toggle', 'cycle'].includes(setting.kind) || !nonempty(setting.label) ||
        (setting.kind === 'toggle' ? typeof setting.checked !== 'boolean' : !nonempty(setting.state)))) {
    throw new TypeError(`Object ${objectId} settings controls are invalid.`);
  }
  return content;
}

/** The cloud a selected dataset turns on, if it names one. */
export function selectedDatasetVolume(controls: ObjectControls, datasetId: string | null): DatasetVolume | null {
  if (datasetId === null) return null;
  return (controls.datasets?.controls ?? []).find(dataset => dataset.id === datasetId)?.volume ?? null;
}

export function objectCycleStates(control: CycleControl): readonly CycleState[] {
  const states = control.states ?? (control.name === 'speed' ? OBJECT_SPEED_STATES : null);
  if (!Array.isArray(states) || !states.length || states.some(state => !nonempty(state.label) || !Number.isFinite(state.value)) ||
      new Set(states.map(state => state.label)).size !== states.length || new Set(states.map(state => state.value)).size !== states.length ||
      !states.some(state => state.label === control.state)) {
    throw new TypeError(`Cycle ${control.name} requires its actual states and default.`);
  }
  return states;
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

export function requireObjectRuntimeDefinition<T extends { readonly schema: string; readonly id: string; readonly controls: ObjectControls }>(
  definition: T, { objectId = definition?.id, controls }: { objectId?: string; controls?: ObjectControls } = {},
): T {
  if (definition?.schema !== OBJECT_RUNTIME_SCHEMA) throw new TypeError('Object runtime requires the data-only prepared definition.');
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id ?? '') || definition.id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  if (controls !== undefined && definition.controls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
  return definition;
}
