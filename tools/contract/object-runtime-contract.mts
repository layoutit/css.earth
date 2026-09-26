import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA } from "../../src/platform/prepared-schema.mts";
import { requirePreparedPresentation } from "../../src/platform/prepared-presentation-contract.mts";
import type { PreparedPresentationContract } from "../../src/platform/prepared-presentation-contract.mts";
import type { PreparedAssets } from "@cssearth/renderer/rendering/prepared-residency.ts";
import { requireObjectControls } from '../../site/scene/scene-contract.mts';
import { isRecord, requireRecord } from '@cssearth/core';

export type CheckedObjectRuntimeDefinition = Omit<PreparedPresentationContract, 'schema'> & {
  schema: typeof PREPARED_OBJECT_RUNTIME_SCHEMA;
  id: string;
  controls: ReturnType<typeof requireObjectControls>;
};
const retentionModes = new Set(["selection", "mount", "warm"]);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;

export function requirePreparedResourceCatalog(input: unknown): PreparedAssets {
  const assets = requireRecord(input, 'Prepared resources');
  if (!Array.isArray(assets.entries) || !Array.isArray(assets.pools) || !Array.isArray(assets.startup)) {
    throw new TypeError("Prepared resources require entries, pools, and startup keys.");
  }
  const pools = new Map<string, Record<string, unknown>>();
  for (const value of assets.pools as unknown[]) {
    const pool = requireRecord(value, 'Prepared resource pool');
    if (!nonempty(pool.id) || pools.has(pool.id) ||
        typeof pool.capacity !== 'number' || !Number.isSafeInteger(pool.capacity) || pool.capacity < 1 ||
        typeof pool.concurrency !== 'number' || !Number.isSafeInteger(pool.concurrency) || pool.concurrency < 1 || pool.concurrency > pool.capacity ||
        typeof pool.retention !== 'string' || !retentionModes.has(pool.retention) || typeof pool.reuse !== "boolean" ||
        (pool.decoding !== undefined && (typeof pool.decoding !== 'string' || !["auto", "sync", "async"].includes(pool.decoding))) ||
        (pool.eviction !== undefined && (typeof pool.eviction !== 'string' || !["unused", "capacity"].includes(pool.eviction))) ||
        (pool.stabilityMilliseconds !== undefined &&
          (typeof pool.stabilityMilliseconds !== 'number' || !Number.isFinite(pool.stabilityMilliseconds) || pool.stabilityMilliseconds < 0))) {
      throw new TypeError(`Prepared resource pool is invalid: ${pool.id}.`);
    }
    pools.set(pool.id, pool);
  }
  const entries = new Map<string, Record<string, unknown>>();
  for (const value of assets.entries as unknown[]) {
    const entry = requireRecord(value, 'Prepared resource entry');
    if (!nonempty(entry.key) || entries.has(entry.key) ||
        !nonempty(entry.url) || !entry.url.startsWith("/scenes/") || typeof entry.pool !== 'string' || !pools.has(entry.pool)) {
      throw new TypeError(`Prepared resource identity is invalid: ${entry.key}.`);
    }
    entries.set(entry.key, entry);
  }
  requireResourceKeys(assets.startup, entries, "Startup");
  // Each pool, entry and startup reference above has passed its runtime contract.
  return input as PreparedAssets;
}

function requireResourceKeys(values: unknown, entries: ReadonlyMap<string, unknown>, label: string): void {
  if (!Array.isArray(values)) throw new TypeError(`${label} is not a list of resource keys.`);
  const duplicate = values.filter((key, index) => values.indexOf(key) !== index), undeclared = values.filter(key => typeof key !== 'string' || !entries.has(key));
  if (duplicate.length || undeclared.length) {
    throw new TypeError(`${label} contains duplicate (${duplicate.slice(0, 5).join(', ') || 'none'}) or undeclared (${undeclared.slice(0, 5).map(String).join(', ') || 'none'}) resource keys.`);
  }
}

export function requireObjectRuntimeDefinition(input: unknown, { objectId = isRecord(input) ? input.id : undefined, controls }: {objectId?: unknown; controls?: unknown} = {}): CheckedObjectRuntimeDefinition {
  const definition = requireRecord(input, 'Object runtime');
  if (definition.schema !== PREPARED_OBJECT_RUNTIME_SCHEMA) throw new TypeError("Object runtime requires the data-only prepared definition.");
  const { schema, id, controls: suppliedControls, ...prepared } = definition;
  if (typeof id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(id) || id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  if (controls !== undefined && suppliedControls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
  requirePreparedResourceCatalog(prepared.assets);
  requirePreparedPresentation({ ...prepared, schema: PREPARED_PRESENTATION_SCHEMA }, { controls: suppliedControls });
  // The data-only presentation, controls, resources and identity were validated.
  return input as CheckedObjectRuntimeDefinition;
}
