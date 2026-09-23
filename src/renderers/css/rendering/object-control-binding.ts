import type { ObjectControls, ObjectSelection, ObjectAction } from "../runtime/object-contract.js";
import type { ObjectSelectionState } from "./object-selection-runtime.js";
export interface ObjectControlBindingOptions {
  stage: HTMLElement; controls: ObjectControls; initialSelection: ObjectSelection; getState(): Readonly<ObjectSelectionState>;
  onAction(action: ObjectAction): unknown; onError(error: unknown): void;
}
type SettingInput = HTMLInputElement | HTMLButtonElement;
const isInput = (element: SettingInput): element is HTMLInputElement => element.tagName === "INPUT";

import { requireObjectControls } from "../runtime/object-contract.js";
import { objectCycleStates, requireObjectAction } from "../runtime/object-contract.js";

export function createObjectControlBinding({ stage, controls, initialSelection, getState, onAction, onError }: ObjectControlBindingOptions) {
  requireObjectControls(controls);
  if (!stage?.ownerDocument || [getState, onAction, onError].some(callback => typeof callback !== "function")) {
    throw new TypeError("Object controls require the mounted document and shared selection endpoint.");
  }
  const document = stage.ownerDocument;
  const information = document.querySelector(".object-information-panel");
  const lensRoot = information?.querySelector(".object-lenses");
  const settingsRoot = document.querySelector(".object-settings");
  const lensInputs = [...(lensRoot?.querySelectorAll<HTMLButtonElement>('button[name="dataset"]') ?? [])];
  const settingsInputs = [...(settingsRoot?.querySelectorAll<SettingInput>("input[name], button[name]") ?? [])]
    .filter(input => !["motion", "heliosphere", "illustrationModels", "surfaceLabels", "minimap", "threeDStars"].includes(input.name));
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
  const nativeChanges = new Map<string, ObjectAction>();
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
    const pressed = new Set(next.plan?.pressedLenses ?? [committed.lensId]);
    for (const root of [lensRoot, settingsRoot]) {
      root?.classList.toggle("is-loading", !ready || next.pending === true);
      root?.setAttribute("aria-busy", String(!ready || next.pending === true));
    }
    for (const [id, input] of lenses) {
      input.disabled = input.type === 'submit' ? false : !ready;
      input.setAttribute("aria-pressed", String(pressed.has(id)));
    }
    for (const legend of legends) legend.hidden = !pressed.has(legend.dataset.lensLegend ?? null);
    for (const control of settingPlans) {
      const input = settingInput(control.name);
      if (nativeChanges.has(control.name)) continue;
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
      } else input.disabled = input.hasAttribute('form') ? false : !ready;
    }
  }
  function act(action: ObjectAction) {
    if (destroyed) return;
    if (!ready) {
      if (action.kind !== 'lens' && settings.get(action.name)?.hasAttribute('form')) {
        nativeChanges.set(action.name, requireObjectAction(controls, action));
      } else publish();
      return;
    }
    try {
      const validated = requireObjectAction(controls, action);
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
    for (const [id, input] of lenses) listen(input, "click", event => {
      if (!ready) return;
      event.preventDefault();
      act({ kind: "lens", id });
    });
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
    for (const input of [...lensInputs, ...settingsInputs]) {
      try { input.disabled = input.type !== 'submit' && !input.hasAttribute('form'); if (input.name === "speed") { input.disabled = true; input.dataset.runtimeReady = "false"; } }
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
    setReady(value = true) {
      if (destroyed) return;
      ready = value === true;
      if (ready) {
        for (const action of nativeChanges.values()) act(action);
        nativeChanges.clear();
      }
      publish();
    },
    stats: () => Object.freeze({ ready, destroyed, actions, listenerCount: listeners.length,
      lensIds: Object.freeze([...lenses.keys()]), settings: Object.freeze([...settings.keys()]), state: lastState }),
    destroy() {
      if (destroyed) return;
      const errors = cleanup();
      if (errors.length) throw new AggregateError(errors, "Object control cleanup failed.");
    },
  });
}
