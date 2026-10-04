import { SHELL_SETTING_NAMES } from '../runtime/object-controls.js';
import type { DatasetControl, SettingControl, ObjectControls } from '../runtime/object-controls.js';

// Shell content validation checks IDs and live control values. Dataset labels,
// presentation fields and cycle-state tables belong to their owning validators.
type ShellSettingControl = Extract<SettingControl, { kind: "toggle" }>
  | Omit<Extract<SettingControl, { kind: "cycle" }>, "states">;

export interface ShellObjectControls {
  readonly datasets: {
    readonly defaultDataset?: unknown;
    readonly controls: readonly Pick<DatasetControl, "id">[];
  } | null | undefined;
  readonly settings: {
    readonly controls: readonly ShellSettingControl[];
  } | null | undefined;
}

function objectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function controls(value: unknown, name: "datasets" | "settings", objectId: string): readonly unknown[] {
  if (value == null) return [];
  if (!objectLike(value) || !Array.isArray(value.controls)) {
    throw new TypeError(`Object ${objectId} ${name} controls must be an array.`);
  }
  return value.controls;
}

// This validates the actual content supplied to the shared shell, not a second
// declaration of supported capabilities. Unknown data stays unknown until its
// properties have passed the corresponding runtime checks.
export function requireObjectControls(content: ObjectControls, objectId?: string): ObjectControls;
export function requireObjectControls(content: unknown, objectId?: string): ShellObjectControls;
export function requireObjectControls(content: unknown, objectId = "unknown"): ShellObjectControls {
  if (!content || typeof content !== "object" ||
      !Object.hasOwn(content, "datasets") || !Object.hasOwn(content, "settings")) {
    throw new TypeError(`Object ${objectId} must export its datasets and settings content.`);
  }
  const record = content as Record<string, unknown>;
  const datasets = controls(record.datasets, "datasets", objectId);
  const settings = controls(record.settings, "settings", objectId);
  const datasetIds = datasets.map((dataset) => objectLike(dataset) ? dataset.id : undefined);
  const defaultDataset = objectLike(record.datasets) ? record.datasets.defaultDataset : undefined;
  if (datasetIds.some((id) => typeof id !== "string" || !id) ||
      new Set(datasetIds).size !== datasetIds.length ||
      (datasets.length && !datasetIds.includes(defaultDataset))) {
    throw new TypeError(`Object ${objectId} dataset IDs/default are invalid.`);
  }
  const names = settings.map((setting) => objectLike(setting) ? setting.name : undefined);
  if (names.some((name) => typeof name !== "string" || !name ||
      SHELL_SETTING_NAMES.has(name)) ||
      new Set(names).size !== names.length ||
      settings.some((setting) => !objectLike(setting) ||
        (setting.kind !== "toggle" && setting.kind !== "cycle") ||
        typeof setting.label !== "string" || !setting.label ||
        (setting.kind === "toggle" ? typeof setting.checked !== "boolean"
          : (typeof setting.state !== "string" || !setting.state)))) {
    throw new TypeError(`Object ${objectId} settings controls are invalid.`);
  }
  const rows = datasets.filter(objectLike);
  const surfaceIds = rows.filter(dataset => dataset.volume === undefined ||
    objectLike(dataset.volume) && dataset.volume.surface === dataset.id).map(dataset => dataset.id);
  for (const dataset of rows) {
    if (dataset.volume === undefined) continue;
    const volume = dataset.volume;
    if (!objectLike(volume) || typeof volume.objectId !== 'string' || !volume.objectId ||
        typeof volume.datasetId !== 'string' || !volume.datasetId || !surfaceIds.includes(volume.surface)) {
      throw new TypeError(`Object ${objectId} dataset ${dataset.id} must name a cloud object, its dataset and a prepared surface dataset.`);
    }
  }
  if (rows.length && !surfaceIds.length) throw new TypeError(`Object ${objectId} has no prepared surface dataset.`);
  return content as ShellObjectControls;
}
