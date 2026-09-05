import { assertBodyLayerRegistrations } from "./body-layer-registration.mjs";
import { requireObjectControls } from "../../site/scene-contract.mjs";
import { PLANET_SPEED_STATES } from "./planet-feature-controls.mjs";
import { validatePreparedCubicSky } from "./cubic-sky-contract.mjs";
import { validateDirectionalSunPlan } from "./directional-sun-contract.mjs";

import { PREPARED_OBJECT_RUNTIME_SCHEMA, PREPARED_PRESENTATION_SCHEMA, requirePreparedPresentation } from "./prepared-presentation-contract.mjs";

export const OBJECT_RUNTIME_SCHEMA = "cssearth-object-runtime@1";
const definitionKeys = new Set(["schema", "id", "controls", "camera", "sky", "sun",
  "inputSelector", "assets", "initialSelection", "reduceSelection",
  "resolvePresentation", "createPresentation", "destinations"]);
const presentationKeys = new Set(["cameraElement", "sceneElement", "bodyLayers",
  "nativeAnimations", "commitSelection", "publishFrame", "observe", "motionFrame", "pageLayers"]);
const retentionModes = new Set(["selection", "mount", "warm"]);
const nonempty = value => typeof value === "string" && value.length > 0;

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a record.`);
  }
  return value;
}

function keys(value, supported, label) {
  record(value, label);
  for (const key of Object.keys(value)) if (!supported.has(key)) {
    throw new TypeError(`${label} has unsupported field ${key}.`);
  }
}

function hook(value, label) {
  if (typeof value !== "function" || /Async|Generator/.test(value.constructor?.name)) {
    throw new TypeError(`${label} must be a synchronous function.`);
  }
}

// Checking the function declaration alone misses ordinary functions that return
// a promise. Every definition/presentation invocation uses this boundary too.
export function invokeRuntimeHook(target, name, args) {
  hook(target?.[name], name);
  const publishesLayers = name === "commitSelection" || name === "publishFrame";
  if (publishesLayers) assertBodyLayerRegistrations(target.bodyLayers, target.sceneElement);
  const result = Reflect.apply(target[name], target, args);
  if (result && typeof result.then === "function") {
    Promise.resolve(result).catch(() => {});
    throw new TypeError(`${name} must be synchronous; it returned a thenable.`);
  }
  if (publishesLayers) assertBodyLayerRegistrations(target.bodyLayers, target.sceneElement);
  return result;
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

export function requireObjectSelection(selection, controls) {
  record(selection, "Object selection");
  if ((controls.lenses?.controls.length ?? 0) &&
      !controls.lenses.controls.some(lens => lens.id === selection.lensId)) {
    throw new TypeError(`Selection contains an undeclared lens: ${selection.lensId}.`);
  }
  for (const control of controls.settings?.controls ?? []) {
    requireObjectAction(controls, { kind: control.kind, name: control.name, value: selection[control.name] });
  }
  for (const value of Object.values(selection)) {
    if (value !== null && typeof value !== "boolean" && typeof value !== "string" &&
        !(typeof value === "number" && Number.isFinite(value))) {
      throw new TypeError("Selection must contain finite, immutable scalar state.");
    }
  }
  return Object.freeze({ ...selection });
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

export function requireResolvedPresentation(plan, definition) {
  record(plan, "Resolved presentation");
  const entries = new Map(definition.assets.entries.map(entry => [entry.key, entry]));
  requireResourceKeys(plan.required, entries, "Required presentation");
  requireResourceKeys(plan.prewarm ?? [], entries, "Prewarm presentation");
  if (plan.pressedLenses !== undefined) {
    const controls = new Map((definition.controls.lenses?.controls ?? []).map(lens => [lens.id, lens]));
    requireResourceKeys(plan.pressedLenses, controls, "Pressed lenses");
  }
  if (plan.navigation !== undefined) {
    const { maximumZoom, camera } = record(plan.navigation, "Selection navigation");
    if (!Number.isFinite(maximumZoom) || maximumZoom < definition.camera.minimumZoom || maximumZoom > definition.camera.maximumZoom ||
        camera != null && (![camera.controlPitch, camera.controlYaw, camera.zoom].every(Number.isFinite) ||
          camera.zoom < definition.camera.minimumZoom || camera.zoom > maximumZoom)) throw new TypeError("Selection navigation requires bounded prepared camera values.");
  }
  return Object.freeze({ ...plan, required: Object.freeze([...plan.required]),
    prewarm: Object.freeze([...(plan.prewarm ?? [])]) });
}

export function requireObjectRuntimeDefinition(definition, { objectId = definition?.id, controls } = {}) {
  if (definition?.schema === PREPARED_OBJECT_RUNTIME_SCHEMA) {
    const { schema, id, controls: suppliedControls, ...prepared } = definition;
    if (!/^[a-z][a-z0-9-]*$/.test(id ?? "") || id !== objectId) throw new TypeError(`Object runtime identity does not match ${objectId}.`);
    if (controls !== undefined && suppliedControls !== controls) throw new TypeError(`${objectId} must supply its actual control-content export.`);
    requirePreparedResourceCatalog(prepared.assets);
    requirePreparedPresentation({ ...prepared, schema: PREPARED_PRESENTATION_SCHEMA }, { controls: suppliedControls });
    return definition;
  }
  keys(definition, definitionKeys, "Object runtime definition");
  if (definition.schema !== OBJECT_RUNTIME_SCHEMA ||
      !/^[a-z][a-z0-9-]*$/.test(definition.id ?? "") || definition.id !== objectId) {
    throw new TypeError(`Object runtime identity does not match ${objectId}.`);
  }
  requireObjectControls(definition.controls, objectId);
  if (controls !== undefined && definition.controls !== controls) {
    throw new TypeError(`${objectId} must supply its actual control-content export.`);
  }
  record(definition.camera, "Prepared camera");
  if (!(definition.camera.sceneScale > 0) || !(definition.camera.minimumZoom > 0) ||
      !(definition.camera.maximumZoom >= definition.camera.minimumZoom)) {
    throw new TypeError("Object runtime requires its complete prepared camera plan.");
  }
  validatePreparedCubicSky(definition.sky, { requireSun: false });
  if (definition.sun != null) validateDirectionalSunPlan(definition.sun);
  if (definition.inputSelector != null && !nonempty(definition.inputSelector)) {
    throw new TypeError("Object input selector must be supplied data or null for the stage.");
  }
  if (definition.destinations !== undefined) {
    const { catalog, defaultLens, statuses } = record(definition.destinations, "Destinations");
    if (!catalog?.url?.startsWith("/scenes/") || !Number.isSafeInteger(catalog.bytes) || catalog.bytes < 1 ||
        !Number.isSafeInteger(catalog.count) || catalog.count < 1 || !/^[a-f0-9]{64}$/.test(catalog.sha256 ?? "") ||
        !definition.controls.lenses?.controls.some(lens => lens.id === defaultLens) ||
        !nonempty(statuses?.detail) || !nonempty(statuses?.overview)) throw new TypeError("Destinations require a pinned catalogue, default lens and status content.");
  }
  requirePreparedResourceCatalog(definition.assets);
  requireObjectSelection(definition.initialSelection, definition.controls);
  for (const [name, value] of Object.entries(initialObjectSelection(definition.controls))) {
    if (!Object.is(definition.initialSelection[name], value)) {
      throw new TypeError(`Initial ${name} must match the actual control-content default.`);
    }
  }
  for (const name of ["reduceSelection", "resolvePresentation", "createPresentation"]) hook(definition[name], name);
  return definition;
}

export function requireObjectPresentation(presentation, { stage } = {}) {
  keys(presentation, presentationKeys, "Object presentation");
  for (const name of ["cameraElement", "sceneElement"]) {
    const element = presentation[name];
    if (element?.nodeType !== 1 || !element.style || typeof element.remove !== "function") {
      throw new TypeError(`Presentation ${name} must be a retained element.`);
    }
  }
  for (const name of ["commitSelection", "publishFrame"]) hook(presentation[name], name);
  if (presentation.observe !== undefined) hook(presentation.observe, "observe");
  if (presentation.nativeAnimations !== undefined && !Array.isArray(presentation.nativeAnimations)) {
    throw new TypeError("Presentation nativeAnimations must be an array of owned handles.");
  }
  if (stage && (!stage.contains(presentation.cameraElement) ||
      !presentation.cameraElement.contains(presentation.sceneElement) ||
      presentation.cameraElement.closest(".planet-stage") !== stage)) {
    throw new TypeError("Presentation camera and scene must belong to the mounted stage.");
  }
  if (presentation.motionFrame !== undefined && (!Array.isArray(presentation.motionFrame) ||
      !presentation.motionFrame.length || presentation.motionFrame.some(node => !presentation.sceneElement.contains(node)))) {
    throw new TypeError("Motion frame anchors must belong to the retained scene.");
  }
  if (presentation.pageLayers !== undefined) {
    if (!Array.isArray(presentation.pageLayers) || new Set(presentation.pageLayers.map(layer => layer.id)).size !== presentation.pageLayers.length ||
        presentation.pageLayers.some(layer => !nonempty(layer.id) || !layer.plan || !nonempty(layer.className) ||
          !nonempty(layer.textureClassName) || !Array.isArray(layer.lensIds) || !layer.lensIds.length ||
          !presentation.sceneElement.contains(layer.system) || !layer.system.contains(layer.carrier))) {
      throw new TypeError("Prepared page layers require unique ids, content and retained anchors.");
    }
  }
  assertBodyLayerRegistrations(presentation.bodyLayers, presentation.sceneElement);
  Object.freeze(presentation.bodyLayers);
  return Object.freeze(presentation);
}
