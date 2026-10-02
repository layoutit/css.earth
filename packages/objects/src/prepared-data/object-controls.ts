export const SHELL_SETTING_NAMES: ReadonlySet<string> = new Set(['motion', 'lightCurves', 'heliosphere', 'illustrationModels', 'surfaceLabels']);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export const OBJECT_RUNTIME_SCHEMA = 'cssearth-object-runtime@5';

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

export function requireObjectRuntimeDefinition<T extends { readonly schema: string; readonly id: string; readonly controls: ObjectControls }>(
  definition: T, { objectId = definition?.id, controls }: { objectId?: string; controls?: ObjectControls } = {},
): T {
  if (definition?.schema !== OBJECT_RUNTIME_SCHEMA) throw new TypeError('Object runtime requires the data-only prepared definition.');
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id ?? '') || definition.id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  if (controls !== undefined && definition.controls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
  return definition;
}

export const OBJECT_SPEED_STATES = Object.freeze([
  Object.freeze({ label: "off", value: 0 }),
  Object.freeze({ label: "normal", value: 1 }),
  Object.freeze({ label: "fast", value: 2 }),
  Object.freeze({ label: "fastest", value: 3 }),
  Object.freeze({ label: "superfast", value: 4 }),
]);

export function objectCycleStates(control: CycleControl): readonly CycleState[] {
  const states = control.states ?? (control.name === 'speed' ? OBJECT_SPEED_STATES : null);
  if (!Array.isArray(states) || !states.length || states.some(state => !nonempty(state.label) || !Number.isFinite(state.value)) ||
      new Set(states.map(state => state.label)).size !== states.length || new Set(states.map(state => state.value)).size !== states.length ||
      !states.some(state => state.label === control.state)) {
    throw new TypeError(`Cycle ${control.name} requires its actual states and default.`);
  }
  return states;
}
