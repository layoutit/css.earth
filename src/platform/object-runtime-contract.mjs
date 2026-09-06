import { requireObjectControls } from "../../site/scene-contract.mjs";
import { PLANET_SPEED_STATES } from "./planet-feature-controls.mjs";

import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA, requirePreparedPresentation } from "./prepared-presentation-contract.mjs";

export const OBJECT_RUNTIME_SCHEMA = PREPARED_OBJECT_RUNTIME_SCHEMA;
const retentionModes = new Set(["selection", "mount", "warm"]);
const nonempty = value => typeof value === "string" && value.length > 0;

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record.`);
  }
  return value;
}

export function objectCycleStates(control) {
  const states = control.states ?? (control.name === "speed" ? PLANET_SPEED_STATES : null);
  if (!Array.isArray(states) || !states.length ||
      states.some(state => !nonempty(state.label) || !Number.isFinite(state.value)) ||
      new Set(states.map(state => state.label)).size !== states.length ||
      new Set(states.map(state => state.value)).size !== states.length ||
      !states.some(state => state.label === control.state)) {
    throw new TypeError(`Cycle ${control.name} requires its actual states and default.`);
  }
  return states;
}

export function initialObjectSelection(controls) {
  requireObjectControls(controls);
  const selection = { lensId: controls.lenses?.defaultLens ?? null };
  for (const control of controls.settings?.controls ?? []) {
    selection[control.name] = control.kind === "toggle" ? control.checked
      : objectCycleStates(control).find(state => state.label === control.state).value;
  }
  return Object.freeze(selection);
}

export function requireObjectAction(controls, action) {
  record(action, "Object action");
  if (action.kind === "lens") {
    if (!(controls.lenses?.controls ?? []).some(lens => lens.id === action.id)) {
      throw new RangeError(`Unknown object lens: ${action.id}.`);
    }
  } else {
    const control = (controls.settings?.controls ?? []).find(control => control.name === action.name);
    if (!control || control.kind !== action.kind ||
        (control.kind === "toggle" ? typeof action.value !== "boolean"
          : !objectCycleStates(control).some(state => state.value === action.value))) {
      throw new RangeError(`Unknown object control action: ${action.name}.`);
    }
  }
  return Object.freeze({ ...action });
}

export function reduceObjectSelection(selection, action) {
  return Object.freeze(action.kind === "lens"
    ? { ...selection, lensId: action.id }
    : { ...selection, [action.name]: action.value });
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
