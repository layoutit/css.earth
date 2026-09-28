import type { ObjectControls, ObjectSelection, ObjectAction } from "../runtime/object-contract.js";
import type { ObjectSelectionState } from "./object-selection-runtime.js";
import { SHELL_SETTING_NAMES } from '../runtime/shell-settings.js';
export interface ObjectControlBindingOptions {
  stage: HTMLElement; controls: ObjectControls; initialSelection: ObjectSelection; getState(): Readonly<ObjectSelectionState>;
  onAction(action: ObjectAction): unknown; onError(error: unknown): void;
}
type SettingInput = HTMLInputElement | HTMLButtonElement;
const isInput = (element: SettingInput): element is HTMLInputElement => element.tagName === "INPUT";

// Every publication writes only what changed: a view-driven texture re-plan republishes this state, and an unchanged
// attribute write still reaches the DOM (docs/performance/motion-freezes-membership.md).
const setAttribute = (element: Element, name: string, value: string) => { if (element.getAttribute(name) !== value) element.setAttribute(name, value); };

/** Keep the collapsed dataset's image and text aligned with the committed option, including sequence steps. */
export function publishDatasetPreview(root: ParentNode | null, buttons: readonly HTMLButtonElement[]) {
  if (!root) return;
  const previews = root.querySelectorAll<HTMLElement>('[data-lens-selected]');
  const select = root.querySelector<HTMLSelectElement>('[data-lens-native-select]');
  if (previews.length === 0 && !select) return;
  const pressed = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
  const visible = buttons.find(button => button.getAttribute('aria-pressed') === 'true' &&
    button.closest<HTMLElement>('[data-lens-option]')?.hidden !== true);
  const group = pressed?.closest<HTMLElement>('[data-step-group]')?.dataset.stepGroup;
  const listed = group ? buttons.find(button => {
    const option = button.closest<HTMLElement>('[data-step-group]');
    return option?.dataset.stepGroup === group && option.dataset.stepListed === 'true';
  }) : undefined;
  const selected = visible?.getAttribute('value') ?? listed?.getAttribute('value') ?? pressed?.getAttribute('value');
  for (const preview of previews) {
    const hidden = preview.dataset.lensSelected !== selected;
    if (preview.hidden !== hidden) preview.hidden = hidden;
  }
  if (select && selected) {
    for (const option of select.querySelectorAll('option')) {
      const selectedOption = option.value === selected;
      if (option.hasAttribute('selected') !== selectedOption) option.toggleAttribute('selected', selectedOption);
      const button = buttons.find(button => button.value === option.value);
      const disabled = !button || button.disabled;
      if (option.disabled !== disabled) option.disabled = disabled;
    }
    if (select.value !== selected) select.value = selected;
  }
}

/** Native responses and retained controls publish the same committed dataset presentation. */
export function publishDatasetSelection(buttons: readonly HTMLButtonElement[], details: readonly { id: string; panel: HTMLElement }[],
  contexts: readonly HTMLElement[], pressed: ReadonlySet<string | null>, previewRoot: ParentNode | null = null) {
  for (const button of buttons) setAttribute(button, 'aria-pressed', String(pressed.has(button.getAttribute('value') ?? '')));
  const active = buttons.find(button => pressed.has(button.getAttribute('value') ?? ''))?.getAttribute('value');
  // A dataset shown as a sequence lists only its first step; that entry stays pressed while any of its steps is shown.
  const groups = new Map<string, boolean>();
  for (const button of buttons) {
    const group = button.closest<HTMLElement>('[data-step-group]')?.dataset.stepGroup;
    if (group) groups.set(group, groups.get(group) === true || pressed.has(button.getAttribute('value') ?? ''));
  }
  for (const button of buttons) {
    const option = button.closest<HTMLElement>('[data-step-group]');
    if (option?.dataset.stepListed === 'true') setAttribute(button, 'aria-pressed', String(groups.get(option.dataset.stepGroup!) === true));
  }
  for (const { id, panel } of details) if (panel.hidden !== (id !== active)) panel.hidden = id !== active;
  for (const context of contexts) {
    const hidden = context.dataset.datasetContext !== active;
    if (context.hidden !== hidden) context.hidden = hidden;
  }
  publishDatasetPreview(previewRoot, buttons);
}

import { requireObjectControls } from "../runtime/object-contract.js";
import { objectCycleStates, requireObjectAction } from "../runtime/object-contract.js";

export function createObjectControlBinding({ stage, controls, initialSelection, getState, onAction, onError }: ObjectControlBindingOptions) {
  requireObjectControls(controls);
  if (!stage?.ownerDocument || [getState, onAction, onError].some(callback => typeof callback !== "function")) {
    throw new TypeError("Object controls require the mounted document and shared selection endpoint.");
  }
  const document = stage.ownerDocument;
  const information = document.querySelector(".object-information-panel");
  // Form ownership survives moving a dataset from the body card to its system card.
  const lensForm = information?.querySelector<HTMLFormElement>('form[data-dataset-form]');
  const lensRoot = lensForm?.closest(".object-lenses");
  const settingsRoot = document.querySelector(".object-settings");
  const formButtons = [...(lensForm?.elements ?? [])]
    .filter((input): input is HTMLButtonElement => input.tagName === 'BUTTON' && input.getAttribute('name') === 'dataset');
  // Step buttons submit a neighbouring dataset of a sequence; they are not the dataset's own control.
  const lensInputs = formButtons.filter(input => !input.hasAttribute('data-dataset-step'));
  const stepInputs = formButtons.filter(input => input.hasAttribute('data-dataset-step'));
  const sequences = new Map<string, string[]>();
  for (const input of lensInputs) {
    const group = input.closest<HTMLElement>('[data-step-group]')?.dataset.stepGroup;
    if (group) sequences.set(group, [...(sequences.get(group) ?? []), input.value]);
  }
  const settingsInputs = [...(settingsRoot?.querySelectorAll<SettingInput>("input[name], button[name]") ?? [])]
    .filter(input => !SHELL_SETTING_NAMES.has(input.name));
  const details = lensInputs.map(input => {
    const id = input.getAttribute('aria-controls');
    const panel = id ? document.getElementById(id) : null;
    if (!panel) throw new Error(`Rendered dataset details are missing: ${input.value}.`);
    return { id: input.value, panel };
  });
  // The shell can move a dataset's details outside the form's original root.
  const playInputs = details.flatMap(({ panel }) => [...panel.querySelectorAll<HTMLButtonElement>('[data-dataset-play]')]);
  const contexts = [...(information?.querySelectorAll<HTMLElement>('[data-dataset-context]') ?? [])];
  const busyRoots = new Set([lensRoot, settingsRoot].filter((root): root is Element => !!root));
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
  let playing: string | null = null, currentGroup: string | null = null;
  let playTimer: ReturnType<typeof setTimeout> | null = null;
  function clearPlayTimer() {
    if (playTimer !== null) clearTimeout(playTimer);
    playTimer = null;
  }
  function stopPlayback() { playing = null; clearPlayTimer(); }
  function publishPlayback(next: Readonly<ObjectSelectionState>) {
    const step = lensInputs.find(input => input.value === next.desired.lensId)
      ?.closest<HTMLElement>('[data-step-group]');
    const group = step?.dataset.stepGroup ?? null;
    // Entering a sequence never starts playback; only its Play button does.
    if (ready && group !== currentGroup) { stopPlayback(); currentGroup = group; }
    const members = playing ? sequences.get(playing) : undefined;
    if (!ready || document.hidden || next.error || !members?.includes(next.desired.lensId ?? '')) stopPlayback();
    if (next.pending) clearPlayTimer();
    // Keep each committed map on screen for 1.5 seconds. Loading the next one never skips a date.
    if (playing && members && members.length > 1 && !next.pending && playTimer === null) {
      playTimer = setTimeout(() => {
        playTimer = null;
        const state = getState();
        if (!ready || destroyed || document.hidden || state.pending || state.error || !playing) { publish(); return; }
        const index = members.indexOf(state.committed?.lensId ?? '');
        if (index < 0) { stopPlayback(); publish(); return; }
        act({ kind: 'lens', id: members[(index + 1) % members.length] });
      }, 1500);
    }
    for (const input of playInputs) {
      const active = playing === input.dataset.datasetPlay;
      if (input.disabled !== !ready) input.disabled = !ready;
      setAttribute(input, 'aria-pressed', String(active));
      setAttribute(input, 'aria-label', active ? 'Pause sequence' : 'Play sequence');
      const label = active ? 'Pause' : 'Play';
      if (input.textContent !== label) input.textContent = label;
    }
  }
  const nativeChanges = new Map<string, ObjectAction>();
  const listeners: (() => void)[] = [];
  function listen(input: EventTarget, event: string, callback: EventListener) {
    input.addEventListener(event, callback);
    listeners.push(() => input.removeEventListener(event, callback));
  }
  function publish(next = getState()) {
    if (destroyed) return;
    lastState = next;
    const committed = next.committed ?? initialSelection;
    const shown = next.pending ? next.desired : committed;
    const pressed = new Set(next.plan?.pressedLenses ?? [committed.lensId]);
    for (const input of lensInputs) {
      const root = input.closest('.object-lenses');
      if (root) busyRoots.add(root);
    }
    for (const root of busyRoots) {
      const busy = !ready || next.pending === true;
      setAttribute(root, "aria-busy", String(busy));
    }
    for (const input of lensInputs) {
      const disabled = input.type === 'submit' ? false : !ready;
      if (input.disabled !== disabled) input.disabled = disabled;
    }
    const focusedPlay = playInputs.find(input => input === document.activeElement);
    publishDatasetSelection(lensInputs, details, contexts, pressed, lensRoot);
    publishPlayback(next);
    // Each date owns its details panel; carry keyboard focus to its matching Pause button when it changes.
    if (focusedPlay?.closest<HTMLElement>('[data-lens-details]')?.hidden) {
      playInputs.find(input => input.dataset.datasetPlay === focusedPlay.dataset.datasetPlay &&
        !input.closest<HTMLElement>('[data-lens-details]')?.hidden)?.focus();
    }
    for (const control of settingPlans) {
      const input = settingInput(control.name);
      if (nativeChanges.has(control.name)) continue;
      if (control.kind === "toggle" && isInput(input)) { const checked = shown[control.name] === true; if (input.checked !== checked) input.checked = checked; }
      else {
        const selected = objectCycleStates(control.kind === "cycle" ? control : invalidCycle()).find(state => state.value === shown[control.name]);
        if (!selected) throw new Error(`Selected ${control.name} is not declared by its content.`);
        if (isInput(input) && input.type === "range" && input.value !== String(selected.value)) input.value = String(selected.value);
        if (input.dataset.state !== selected.label) input.dataset.state = selected.label;
        setAttribute(input, "aria-label", `${control.label}: ${selected.label}`);
      }
      if (control.name === "speed") {
        // The shell alone enables Speed when Motion is requested. Runtime
        // readiness can block it, and router readiness republishes shell state.
        if (input.dataset.runtimeReady !== String(ready)) input.dataset.runtimeReady = String(ready);
        if (!ready && !input.disabled) input.disabled = true;
      } else { const disabled = input.hasAttribute('form') ? false : !ready; if (input.disabled !== disabled) input.disabled = disabled; }
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
        stopPlayback();
        publish();
        onError(error);
      });
    } catch (error) { if (!destroyed) { stopPlayback(); publish(); onError(error); } }
  }
  try {
    publish();
    for (const [id, input] of lenses) listen(input, "click", event => {
      if (!ready) return;
      event.preventDefault();
      stopPlayback();
      act({ kind: "lens", id });
    });
    for (const input of stepInputs) {
      // The first and last steps render a disabled button with nothing to step to.
      if (input.disabled && !input.dataset.datasetStep) continue;
      if (!lenses.has(input.value)) throw new Error(`A dataset step names an unknown dataset: ${input.value}.`);
      listen(input, "click", event => {
        if (!ready) return;
        event.preventDefault();
        stopPlayback();
        act({ kind: "lens", id: input.value });
      });
    }
    for (const input of playInputs) {
      const group = input.dataset.datasetPlay!;
      if ((sequences.get(group)?.length ?? 0) < 2) throw new Error(`Playback requires a dataset sequence: ${group}.`);
      listen(input, 'click', () => {
        if (!ready) return;
        const pause = playing === group;
        stopPlayback();
        if (!pause) playing = group;
        publish();
      });
    }
    if (playInputs.length) listen(document, 'visibilitychange', () => { if (document.hidden) { stopPlayback(); publish(); } });
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
  function cleanup(preserveControls = false) {
    destroyed = true; ready = false;
    stopPlayback();
    publishPlayback(getState());
    const errors = [];
    for (const remove of listeners.splice(0)) { try { remove(); } catch (error) { errors.push(error); } }
    if (preserveControls) return errors;
    for (const input of [...lensInputs, ...settingsInputs]) {
      try {
        const disabled = input.name === 'speed' || input.type !== 'submit' && !input.hasAttribute('form');
        if (input.disabled !== disabled) input.disabled = disabled;
        if (input.name === 'speed' && input.dataset.runtimeReady !== 'false') input.dataset.runtimeReady = 'false';
      }
      catch (error) { errors.push(error); }
    }
    for (const root of busyRoots) {
      try { setAttribute(root, 'aria-busy', 'false'); }
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
    destroy({ preserveControls = false }: { preserveControls?: boolean } = {}) {
      if (destroyed) return;
      const errors = cleanup(preserveControls);
      if (errors.length) throw new AggregateError(errors, "Object control cleanup failed.");
    },
  });
}
