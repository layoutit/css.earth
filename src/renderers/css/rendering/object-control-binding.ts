import type { GeographicEntity, GeographicLensState } from '../paging/geographic-types.js';
import { createGeographicLensBinding } from './geographic-lens-binding.js';
import type { ObjectControls, ObjectSelection, ObjectAction } from "../runtime/object-contract.js";
import type { ObjectSelectionState } from "./object-selection-runtime.js";
export interface ObjectControlBindingOptions {
  stage: HTMLElement; controls: ObjectControls; initialSelection: ObjectSelection; getState(): Readonly<ObjectSelectionState>;
  getEntity?(): GeographicEntity | null; getGeographicState?(): GeographicLensState | null; getPageError?(): boolean;
  onAction(action: ObjectAction): unknown; onError(error: unknown): void;
}
type SettingInput = HTMLInputElement | HTMLButtonElement;
const isInput = (element: SettingInput): element is HTMLInputElement => element.tagName === "INPUT";

import { requireObjectControls } from "../runtime/object-contract.js";
import { objectCycleStates, requireObjectAction, objectLensAvailable } from "../runtime/object-contract.js";

export function createObjectControlBinding({ stage, controls, initialSelection, getState, onAction, onError, getEntity = () => null, getGeographicState = () => null, getPageError = () => false }: ObjectControlBindingOptions) {
  requireObjectControls(controls);
  if (!stage?.ownerDocument || [getState, onAction, onError].some(callback => typeof callback !== "function")) {
    throw new TypeError("Object controls require the mounted document and shared selection endpoint.");
  }
  const document = stage.ownerDocument;
  const lensRoot = document.querySelector(".planet-lenses");
  const settingsRoot = document.querySelector(".planet-settings");
  const detailsRoot = document.querySelector(".planet-lens-details");
  const lensInputs = [...(lensRoot?.querySelectorAll<HTMLButtonElement>('button[name="lens"]') ?? [])].filter(input => !input.hasAttribute("data-geographic-lens"));
  const geographic = createGeographicLensBinding(lensRoot, controls.lenses?.geographicCapacity ?? 0);
  const settingsInputs = [...(settingsRoot?.querySelectorAll<SettingInput>("input[name], button[name]") ?? [])]
    .filter(input => !["motion", "skyContrast", "heliosphere", "asteroidOrbits", "asteroidLabels"].includes(input.name));
  const legends = [...(lensRoot?.querySelectorAll<HTMLElement>("[data-lens-legend]") ?? [])]
    .filter(legend => legend.dataset?.lensLegend !== undefined);
  const lenses = new Map(lensInputs.map(input => [input.value, input]));
  const settings = new Map(settingsInputs.map(input => [input.name, input]));
  function settingInput(name: string): SettingInput {
    const input = settings.get(name);
    if (!input) throw new Error(`Rendered object control is missing: ${name}.`);
    return input;
  }
  function invalidCycle(): never { throw new Error("A cycle requires prepared cycle content."); }
  const lensPlans = controls.lenses?.controls ?? [], settingPlans = controls.settings?.controls ?? [];
  if (lenses.size !== lensInputs.length || lenses.size !== lensPlans.length ||
      lensPlans.some(lens => !lenses.has(lens.id)) || settings.size !== settingsInputs.length || settings.size !== settingPlans.length ||
      settingPlans.some(control => !settings.has(control.name))) {
    throw new Error("Rendered object controls do not match their actual package content.");
  }
  for (const control of settingPlans) {
    const input = settingInput(control.name);
    if (control.kind === "toggle" ? input.type !== "checkbox"
      : input.tagName !== "BUTTON" && input.type !== "range") throw new Error(`Rendered ${control.name} control has the wrong input type.`);
    if (control.kind === "cycle") {
      const states = objectCycleStates(control);
      if (isInput(input) && input.type === "range") {
        const values = states.map(state => state.value).sort((a, b) => a - b);
        const minimum = Number(input.min), maximum = Number(input.max), step = Number(input.step);
        if (minimum !== values[0] || maximum !== values.at(-1) || !(step > 0) ||
            values.some((value, index) => value !== minimum + index * step)) {
          throw new Error(`Rendered ${control.name} range does not match its declared states.`);
        }
      }
    }
  }
  let ready = false, destroyed = false, lastState: Readonly<ObjectSelectionState> | null = null, actions = 0;
  const listeners: (() => void)[] = [];
  function listen(input: SettingInput, event: string, callback: EventListener) {
    input.addEventListener(event, callback);
    listeners.push(() => input.removeEventListener(event, callback));
  }
  function publish(next = getState()) {
    if (destroyed) return;
    lastState = next;
    const committed = next.committed ?? initialSelection;
    const shown = next.pending ? next.desired : committed;
    const overlay = getGeographicState();
    const pressed = new Set(overlay?.id ? [overlay.id] : next.plan?.pressedLenses ?? [committed.lensId]);
    geographic.publish(getEntity(), overlay, ready);
    for (const status of detailsRoot?.querySelectorAll<HTMLElement>('[data-page-status]') ?? []) {
      const failed = !overlay?.id && pressed.has(status.dataset.pageStatus ?? '') && getPageError();
      status.textContent = failed ? 'Some imagery could not load. Select this dataset again to retry.' : '';
      status.hidden = !failed;
    }
    for (const root of [lensRoot, settingsRoot]) {
      root?.classList.toggle("is-loading", !ready || next.pending === true || overlay?.status === "loading");
      root?.setAttribute("aria-busy", String(!ready || next.pending === true || overlay?.status === "loading"));
    }
    for (const [id, input] of lenses) {
      const available = objectLensAvailable(controls, getEntity(), id);
      input.disabled = !ready || !available;
      const option = input.closest<HTMLElement>("[data-lens-option]");
      if (option) option.dataset.entityAvailable = String(available);
      input.setAttribute("aria-pressed", String(pressed.has(id)));
    }
    for (const legend of legends) legend.hidden = !pressed.has(legend.dataset.lensLegend ?? null);
    for (const control of settingPlans) {
      const input = settingInput(control.name);
      if (control.kind === "toggle" && isInput(input)) input.checked = shown[control.name] === true;
      else {
        const selected = objectCycleStates(control.kind === "cycle" ? control : invalidCycle()).find(state => state.value === shown[control.name]);
        if (!selected) throw new Error(`Selected ${control.name} is not declared by its content.`);
        if (isInput(input) && input.type === "range") input.value = String(selected.value);
        input.dataset.state = selected.label;
        input.setAttribute("aria-label", `${control.label}: ${selected.label}`);
      }
      if (control.name === "speed") {
        // The shell alone enables Speed when Motion is requested. Runtime
        // readiness can block it, and router readiness republishes shell state.
        input.dataset.runtimeReady = String(ready);
        if (!ready) input.disabled = true;
      } else input.disabled = !ready;
    }
  }
  function act(action: ObjectAction) {
    if (destroyed) return;
    if (!ready) { publish(); return; }
    try {
      const external = action.kind === "lens" && getEntity()?.lenses?.some(lens => lens.id === action.id);
      const validated = external ? action : requireObjectAction(controls, action);
      actions++;
      Promise.resolve(onAction(validated)).catch(error => {
        if (destroyed) return;
        publish();
        onError(error);
      });
    } catch (error) { if (!destroyed) { publish(); onError(error); } }
  }
  try {
    publish();
    for (const input of geographic.inputs) listen(input, "click", () => { if (!input.disabled) act({ kind: "lens", id: input.value }); });
    for (const [id, input] of lenses) listen(input, "click", () => { if (!input.disabled) act({ kind: "lens", id }); });
    for (const control of settingPlans) {
      const input = settingInput(control.name);
      const event = control.kind === "toggle" ? "change" : input.type === "range" ? "input" : "click";
      listen(input, event, () => {
        const states = control.kind === "cycle" ? objectCycleStates(control) : null;
        const current = (getState().desired ?? initialSelection)[control.name];
        if (control.kind === "toggle") {
          if (!isInput(input)) throw new Error("A toggle requires an input element.");
          act({ kind: "toggle", name: control.name, value: input.checked });
        } else {
          if (!states) throw new Error("A cycle requires its prepared states.");
          const value = input.type === "range" ? Number(input.value)
            : states[(states.findIndex(state => state.value === current) + 1) % states.length].value;
          act({ kind: "cycle", name: control.name, value });
        }
      });
    }
  } catch (error) {
    const errors = cleanup();
    throw errors.length ? new AggregateError([error, ...errors], error instanceof Error ? error.message : String(error), { cause: error }) : error;
  }
  function cleanup() {
    destroyed = true; ready = false;
    const errors = [];
    for (const remove of listeners.splice(0)) { try { remove(); } catch (error) { errors.push(error); } }
    for (const input of [...lensInputs, ...geographic.inputs, ...settingsInputs]) {
      try { input.disabled = true; if (input.name === "speed") input.dataset.runtimeReady = "false"; }
      catch (error) { errors.push(error); }
    }
    for (const root of [lensRoot, settingsRoot]) {
      try { root?.classList.remove("is-loading"); root?.setAttribute("aria-busy", "false"); }
      catch (error) { errors.push(error); }
    }
    return errors;
  }
  return Object.freeze({
    publish,
    setReady(value = true) { if (destroyed) return; ready = value === true; publish(); },
    stats: () => Object.freeze({ ready, destroyed, actions, listenerCount: listeners.length,
      lensIds: Object.freeze([...lenses.keys()]), settings: Object.freeze([...settings.keys()]), state: lastState }),
    destroy() {
      if (destroyed) return;
      const errors = cleanup();
      if (errors.length) throw new AggregateError(errors, "Object control cleanup failed.");
    },
  });
}
