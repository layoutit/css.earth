import { requireObjectControls } from "../../site/scene-contract.mjs";
import { PLANET_SPEED_STATES } from "./planet-feature-controls.mjs";

import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "./prepared-schema.mjs";

export const OBJECT_RUNTIME_SCHEMA = PREPARED_OBJECT_RUNTIME_SCHEMA;
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

// Prepared content is compiler-validated before serialization. The browser
// checks the version and binding identity, then validates live actions/demands.
export function requireObjectRuntimeDefinition(definition, { objectId = definition?.id, controls } = {}) {
  if (definition?.schema !== PREPARED_OBJECT_RUNTIME_SCHEMA) throw new TypeError("Object runtime requires the data-only prepared definition.");
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id ?? "") || definition.id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  if (controls !== undefined && definition.controls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
  return definition;
}

// Availability belongs to the selected entity's prepared card and the actual
// lens inventory. Entity kinds do not introduce additional runtime branches.
export function objectLensAvailable(controls, entity, id) {
  const lens = controls.lenses?.controls.find(lens => lens.id === id);
  if (!lens) return Boolean(controls.lenses?.geographicCapacity && entity?.lenses?.some(lens => lens.id === id));
  if (!entity) return !lens.entityIds;
  return entity.lensIds.includes(id) && (!lens.entityIds || lens.entityIds.includes(entity.id));
}
