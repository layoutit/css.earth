import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA } from "../src/platform/prepared-schema.mjs";
import { requirePreparedPresentation } from "../src/platform/prepared-presentation-contract.mjs";
const retentionModes = new Set(["selection", "mount", "warm"]);
const nonempty = value => typeof value === "string" && value.length > 0;
function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record.`);
  }
  return value;
}

export function requirePreparedResourceCatalog(assets) {
  record(assets, "Prepared resources");
  if (!Array.isArray(assets.entries) || !Array.isArray(assets.pools) || !Array.isArray(assets.startup)) {
    throw new TypeError("Prepared resources require entries, pools, and startup keys.");
  }
  const pools = new Map();
  for (const pool of assets.pools) {
    if (!nonempty(pool.id) || pools.has(pool.id) ||
        !Number.isSafeInteger(pool.capacity) || pool.capacity < 1 ||
        !Number.isSafeInteger(pool.concurrency) || pool.concurrency < 1 || pool.concurrency > pool.capacity ||
        !retentionModes.has(pool.retention) || typeof pool.reuse !== "boolean" ||
        (pool.decoding !== undefined && !["auto", "sync", "async"].includes(pool.decoding)) ||
        (pool.eviction !== undefined && !["unused", "capacity"].includes(pool.eviction)) ||
        (pool.stabilityMilliseconds !== undefined &&
          (!Number.isFinite(pool.stabilityMilliseconds) || pool.stabilityMilliseconds < 0))) {
      throw new TypeError(`Prepared resource pool is invalid: ${pool.id}.`);
    }
    pools.set(pool.id, pool);
  }
  const entries = new Map();
  for (const entry of assets.entries) {
    if (!nonempty(entry.key) || entries.has(entry.key) ||
        !nonempty(entry.url) || !entry.url.startsWith("/scenes/") || !pools.has(entry.pool)) {
      throw new TypeError(`Prepared resource identity is invalid: ${entry.key}.`);
    }
    entries.set(entry.key, entry);
  }
  requireResourceKeys(assets.startup, entries, "Startup");
  return assets;
}

function requireResourceKeys(values, entries, label) {
  if (!Array.isArray(values) || new Set(values).size !== values.length ||
      values.some(key => !entries.has(key))) {
    throw new TypeError(`${label} contains duplicate or undeclared resource keys.`);
  }
}

export function requireObjectRuntimeDefinition(definition, { objectId = definition?.id, controls } = {}) {
  if (definition?.schema !== PREPARED_OBJECT_RUNTIME_SCHEMA) throw new TypeError("Object runtime requires the data-only prepared definition.");
  const { schema, id, controls: suppliedControls, ...prepared } = definition;
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? "") || id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  if (controls !== undefined && suppliedControls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
  requirePreparedResourceCatalog(prepared.assets);
  requirePreparedPresentation({ ...prepared, schema: PREPARED_PRESENTATION_SCHEMA }, { controls: suppliedControls });
  return definition;
}
