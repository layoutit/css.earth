// A body's transport carries what its default dataset draws. Every other dataset's tables (its selection variants, the
// texture-level addresses of its pages, its image entries) travel in their own small transport, read when that dataset
// is selected and adopted into the decoded definition before the selection resolves. Earth's transport carried all
// seven datasets' tables: 136 KB of its gzipped startup bytes, where the opening view shows one (2026-09-30).
import type { ObjectRuntimeDefinition } from './object-runtime-types.js';
import type { ObjectControls } from './object-controls.js';
import type { PreparedVariant } from './runtime-presentation-types.js';
import type { PreparedResourceEntry } from './runtime-resource-types.js';
import type { PreparedTextureLevels, PreparedTextureTile } from './runtime-presentation-types.js';
import { array, fail, record, text } from './runtime-validation/guards.js';
import { requireAssets } from './runtime-validation/resources-tree.js';
import { requireTextureLevels } from './runtime-validation/prepared-texture-levels.js';
import { requireVariants } from './runtime-validation/presentation.js';

export const PREPARED_DATASET_SCHEMA = 'cssearth-prepared-dataset@1';

/** One texture level's addresses for a dataset's pages: the level resource each page reads, and its sheet tile. */
export interface PreparedDatasetLevel {
  readonly resources: Readonly<Record<string, string>>;
  readonly tiles?: Readonly<Record<string, PreparedTextureTile>>;
}

/** The tables of one dataset the object transport leaves out. */
export interface PreparedDatasetTables {
  readonly schema: typeof PREPARED_DATASET_SCHEMA;
  readonly id: string;
  readonly datasetId: string;
  /** The dataset's complete selection variants, which replace their stand-ins in the definition. */
  readonly variants: readonly PreparedVariant[];
  /** Per texture level, in level order; absent for a body without texture levels. */
  readonly textureLevels?: readonly PreparedDatasetLevel[];
  /** The image entries only this dataset reads. */
  readonly entries: readonly PreparedResourceEntry[];
}

/** The datasets whose tables travel apart: every declared dataset but the default. */
export function deferredDatasetIds(controls: ObjectControls): string[] {
  const datasets = controls.datasets;
  return datasets ? datasets.controls.map(control => control.id).filter(id => id !== datasets.defaultDataset) : [];
}

/** The transport reference of a dataset's tables, beside the object transport's own (`prepared/object.json` gives
 * `prepared/datasets/<dataset>.json`). */
export function preparedDatasetReference(objectReference: string, datasetId: string) {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(datasetId)) throw new TypeError(`Dataset ${JSON.stringify(datasetId)} has no transport reference.`);
  return objectReference.replace(/[^/]*$/u, `datasets/${datasetId}.json`);
}

const datasetOf = (variant: PreparedVariant) => typeof variant.when.datasetId === 'string' ? variant.when.datasetId : null;

/** The variant a definition keeps for a dataset whose tables travel apart: everything but its resource demand and
 * texture writes, so a mount still knows every mesh, subtree and stage binding any selection writes. */
const standIn = (variant: PreparedVariant): PreparedVariant =>
  ({ ...variant, required: [], writes: variant.writes.filter(write => write.kind !== 'texture') });

const pick = <T>(table: Readonly<Record<string, T>>, keep: (key: string) => boolean) =>
  Object.fromEntries(Object.entries(table).filter(([key]) => keep(key)));

/** Split a validated runtime into the object transport's definition and one table set per other dataset. A resource
 * moves only when that dataset alone reads it: a key any other dataset, the startup bank, a material, a fallback or the
 * tree names stays in the definition. The definition that remains is validated here, so a body whose default dataset
 * could not stand alone fails its build rather than its page. */
export function splitPreparedDatasetTables(definition: ObjectRuntimeDefinition): { definition: ObjectRuntimeDefinition; tables: PreparedDatasetTables[] } {
  const deferred = deferredDatasetIds(definition.controls);
  if (!deferred.length) return { definition, tables: [] };
  if (definition.deferredDatasets !== undefined) throw new TypeError(`${definition.id}: the runtime is already split by dataset.`);
  const deferredSet = new Set(deferred), keys = new Set(definition.assets.entries.map(entry => entry.key));
  const users = new Map<string, Set<string | null>>();
  const use = (key: string, dataset: string | null) => {
    let datasets = users.get(key);
    if (!datasets) users.set(key, datasets = new Set());
    datasets.add(dataset);
  };
  for (const variant of definition.variants) {
    const dataset = datasetOf(variant);
    for (const key of variant.required) use(key, dataset);
    for (const write of variant.writes) if (write.kind === 'texture' && write.resource !== null) use(write.resource, dataset);
  }
  const levels = definition.textureLevels?.levels ?? [];
  for (const level of levels) for (const [source, target] of Object.entries(level.resources)) {
    for (const dataset of users.get(source) ?? [null]) use(target, dataset);
  }
  // Every key named anywhere else, as a value or a field name (startup, fallbacks, materials, tree), stays with the
  // definition.
  const tables = new Set<unknown>([definition.variants, definition.assets.entries, ...levels]);
  const pinned = new Set<string>();
  const pin = (value: string) => { if (keys.has(value)) pinned.add(value); };
  const walk = (value: unknown): void => {
    if (typeof value === 'string') { pin(value); return; }
    if (!value || typeof value !== 'object' || tables.has(value)) return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    for (const [field, item] of Object.entries(value)) { pin(field); walk(item); }
  };
  walk(definition);
  const owner = (key: string) => {
    const datasets = users.get(key);
    if (pinned.has(key) || datasets?.size !== 1) return null;
    const [dataset] = datasets;
    return dataset !== undefined && dataset !== null && deferredSet.has(dataset) ? dataset : null;
  };
  const kept = (key: string) => owner(key) === null;
  const levelTables = (level: PreparedTextureLevels['levels'][number], keep: (key: string) => boolean) =>
    ({ resources: pick(level.resources, keep), ...(level.tiles ? { tiles: pick(level.tiles, keep) } : {}) });
  const split: ObjectRuntimeDefinition = {
    ...definition,
    assets: { ...definition.assets, entries: definition.assets.entries.filter(entry => kept(entry.key)) },
    variants: definition.variants.map(variant => deferredSet.has(datasetOf(variant) ?? '') ? standIn(variant) : variant),
    ...(definition.textureLevels ? { textureLevels: { ...definition.textureLevels,
      levels: levels.map(level => ({ minimumDiameter: level.minimumDiameter, ...levelTables(level, kept) })) } } : {}),
    deferredDatasets: deferred,
  };
  try { requireSplitTables(split); }
  catch (cause) { throw new TypeError(`${definition.id}: the default dataset ${definition.controls.datasets?.defaultDataset} cannot travel without ${deferred.join(', ')}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause }); }
  return { definition: split, tables: deferred.map(datasetId => ({
    schema: PREPARED_DATASET_SCHEMA, id: definition.id, datasetId,
    variants: definition.variants.filter(variant => datasetOf(variant) === datasetId),
    ...(definition.textureLevels ? { textureLevels: levels.map(level => levelTables(level, key => owner(key) === datasetId)) } : {}),
    entries: definition.assets.entries.filter(entry => owner(entry.key) === datasetId),
  })) };
}

/** The tables that change when datasets split or adopt: assets, variants and texture levels. */
function requireSplitTables(definition: ObjectRuntimeDefinition) {
  requireAssets(definition.assets);
  const resources = new Set(definition.assets.entries.map(entry => entry.key));
  requireVariants(definition.variants, definition.tree, resources, definition.materials, definition.controls, definition.camera, definition.deferredDatasets);
  if (definition.textureLevels !== undefined) requireTextureLevels(definition.textureLevels, definition.variants, resources);
  requireDeferredDatasets(definition.deferredDatasets, definition);
}

/** A runtime's deferred datasets: declared, never the default, each once, and each standing in with variants that
 * demand nothing and write no texture until its tables arrive. */
export function requireDeferredDatasets(value: unknown, definition: Pick<ObjectRuntimeDefinition, 'controls' | 'variants'>): asserts value is readonly string[] | undefined {
  if (value === undefined) return;
  const ids = array(value, 'deferred datasets').map(id => text(id, 'deferred dataset'));
  const datasets = definition.controls.datasets;
  if (new Set(ids).size !== ids.length || ids.some(id => !datasets?.controls.some(control => control.id === id) || id === datasets.defaultDataset))
    fail('deferred datasets must be declared, other than the default, each once');
  for (const variant of definition.variants) if (ids.includes(datasetOf(variant) ?? '') &&
    (variant.required.length || variant.writes.some(write => write.kind === 'texture')))
    fail(`deferred dataset ${String(variant.when.datasetId)} must stand in without demand or textures`);
}

/** Validate a dataset's tables against the definition they extend: their identity and shape here, their contents as
 * part of the definition they complete (adoptPreparedDatasetTables validates it whole before publishing it). */
export function requirePreparedDatasetTables(value: unknown, definition: Pick<ObjectRuntimeDefinition, 'id' | 'deferredDatasets'>, datasetId: string): asserts value is PreparedDatasetTables {
  const tables = record(value, 'dataset tables', ['schema', 'id', 'datasetId', 'variants', 'textureLevels', 'entries']);
  if (tables.schema !== PREPARED_DATASET_SCHEMA || tables.id !== definition.id || tables.datasetId !== datasetId)
    fail(`dataset tables ${String(tables.id)}/${String(tables.datasetId)} (${String(tables.schema)}) are not ${definition.id}/${datasetId}`);
  if (!definition.deferredDatasets?.includes(datasetId)) fail(`${definition.id} does not wait for dataset ${datasetId}`);
  array(tables.variants, 'dataset variants'); array(tables.entries, 'dataset resource entries');
  if (tables.textureLevels !== undefined) for (const level of array(tables.textureLevels, 'dataset texture levels')) {
    const { resources, tiles } = record(level, 'dataset texture level', ['resources', 'tiles']);
    record(resources, 'dataset level resources');
    if (tiles !== undefined) record(tiles, 'dataset level tiles');
  }
}

/** Return a validated copy of the definition with a dataset's tables merged. Stand-in variants are replaced
 * where they stood, preserving variant order and every committed selection; the input definition is unchanged. */
export function mergePreparedDatasetTables(definition: ObjectRuntimeDefinition, value: unknown, datasetId: string) {
  requirePreparedDatasetTables(value, definition, datasetId);
  const tables = value;
  const incoming = new Map(tables.variants.map(variant => [JSON.stringify(variant.when), variant]));
  let replaced = 0;
  const variants = definition.variants.map(variant => {
    if (datasetOf(variant) !== datasetId) return variant;
    const complete = incoming.get(JSON.stringify(variant.when));
    if (!complete) return fail(`dataset ${datasetId} tables lack the variant ${JSON.stringify(variant.when)}`);
    replaced++;
    return complete;
  });
  if (replaced !== tables.variants.length) fail(`dataset ${datasetId} tables carry variants the definition does not declare`);
  const levels = definition.textureLevels?.levels;
  if ((levels === undefined) !== (tables.textureLevels === undefined) || levels && levels.length !== tables.textureLevels!.length)
    fail(`dataset ${datasetId} texture levels do not match ${definition.id}'s`);
  const textureLevels = definition.textureLevels && levels ? { ...definition.textureLevels, levels: levels.map((level, index) => {
    const own = tables.textureLevels![index]!;
    const tiles = level.tiles || own.tiles ? { tiles: { ...level.tiles, ...own.tiles } } : {};
    return { ...level, resources: { ...level.resources, ...own.resources }, ...tiles };
  }) } : undefined;
  // A copy of this definition shares its asset table (world-context-runtime.ts) and may have adopted the entries first.
  const declared = new Set(definition.assets.entries.map(entry => entry.key));
  const present = tables.entries.filter(entry => declared.has(entry.key)).length;
  if (present && present !== tables.entries.length) fail(`dataset ${datasetId} tables share only some entries with ${definition.id}'s asset table`);
  const merged: ObjectRuntimeDefinition = { ...definition, variants,
    assets: { ...definition.assets, entries: present ? definition.assets.entries : [...definition.assets.entries, ...tables.entries] },
    ...(textureLevels ? { textureLevels } : {}),
    deferredDatasets: definition.deferredDatasets!.filter(id => id !== datasetId) };
  try { requireSplitTables(merged); }
  catch (cause) { throw new TypeError(`${definition.id}: dataset ${datasetId} tables do not complete the definition: ${cause instanceof Error ? cause.message : String(cause)}`, { cause }); }
  return merged;
}
