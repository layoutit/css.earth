import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { createObjectControlBinding } from '../renderers/css/dist/testing.js';
import { initialObjectSelection, reduceObjectSelection, objectCycleStates } from '../renderers/css/dist/testing.js';
import { parsePreparedObjectRuntime } from '../renderers/css/dist/index.js';
import type { ObjectAction, ObjectControls, ObjectSelection } from '../renderers/css/runtime/object-contract.ts';
import type { ObjectSelectionState } from '../renderers/css/rendering/object-selection-runtime.ts';
import type { ObjectControlBindingOptions } from '../renderers/css/rendering/object-control-binding.ts';

const moonControls = parsePreparedObjectRuntime(await loadObjectTestDefinition('moon')).controls;
const saturnControls = parsePreparedObjectRuntime(await loadObjectTestDefinition('saturn')).controls;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
class Input extends EventTarget {
  name = ""; value = ""; checked = false; disabled = false; readonly dataset: Record<string, string | undefined> = {};
  readonly attributes: Record<string, string> = {}; tagName = "INPUT"; type = "checkbox"; min = "0"; max = "4"; step = "1";
  constructor(fields: Partial<Input> = {}) { super(); Object.assign(this, fields); }
  setAttribute(key: string, value: string): void { this.attributes[key] = value; }
  getAttribute(key: string): string | null { return key === "name" ? this.name : key === "value" ? this.value : this.attributes[key] ?? null; }
  closest(): Root | null { return null; }
  hasAttribute(key: string): boolean { return Object.hasOwn(this.attributes, key); }
  emit(type: string): void { this.dispatchEvent(new Event(type)); }
}
class Root {
  private readonly classes = new Set<string>();
  readonly attributes: Record<string, string> = {};
  readonly inputs: Input[];
  constructor(inputs: Input[]) { this.inputs = inputs; }
  // This is the narrow DOM boundary exercised by the renderer: it only reads these mock controls.
  querySelectorAll<T extends Element>(): NodeListOf<T> { return this.inputs as unknown as NodeListOf<T>; }
  setAttribute(key: string, value: string): void { this.attributes[key] = value; }
  readonly classList = {
    toggle: (key: string, on?: boolean): boolean => { if (on) this.classes.add(key); else this.classes.delete(key); return on === true; },
    remove: (key: string): void => { this.classes.delete(key); },
    contains: (key: string): boolean => this.classes.has(key),
  };
}
type InformationPanel = { querySelector(selector: string): { elements: Input[]; closest(): Root } | null; querySelectorAll(): never[] };
type HarnessDocument = { querySelector(selector: string): Root | InformationPanel | null; getElementById(id: string): { hidden: boolean } | null };
type HarnessMutation = (parts: { lensInputs: Input[]; settingInputs: Input[]; stage: HTMLElement; document: HarnessDocument; lensRoot: Root }) => void;
function selectionState(initial: ObjectSelection): ObjectSelectionState {
  return { committed: null, committedBy: null, desired: initial, plan: null, pending: true, loadingMaterial: false, ready: false, error: null, viewRevision: null };
}
function harness(controls: ObjectControls = moonControls, mutate: HarnessMutation = () => {}) {
  const initial = initialObjectSelection(controls);
  const lensInputs = (controls.lenses?.controls ?? []).map(lens => new Input({ name: "dataset", value: lens.id, tagName: "BUTTON", type: "submit" }));
  const settingInputs = (controls.settings?.controls ?? []).map(control => new Input({ name: control.name,
    type: control.kind === "toggle" ? "checkbox" : "range", checked: control.kind === "toggle" && control.checked, value: String(initial[control.name]) }));
  const motion = new Input({ name: "motion" }), surfaceLabels = new Input({ name: "surfaceLabels" }), heliosphere = new Input({ name: "heliosphere" });
  const illustrationModels = new Input({ name: "illustrationModels" });
  settingInputs.push(motion, surfaceLabels, heliosphere, illustrationModels);
  const lensRoot = new Root(lensInputs), settingsRoot = new Root(settingInputs);
  const panels = new Map(lensInputs.map(input => { input.setAttribute('aria-controls', input.value); return [input.value, { hidden: false }]; }));
  const form = { elements: lensInputs, closest: () => lensRoot };
  const information: InformationPanel = { querySelector: selector => selector === 'form[data-dataset-form]' ? form : null, querySelectorAll: () => [] };
  const document: HarnessDocument = { querySelector: selector => selector === ".object-information-panel" ? information : selector === ".object-lenses" ? lensRoot : settingsRoot,
    getElementById: id => panels.get(id) ?? null };
  // The binding accepts an HTMLElement only to reach ownerDocument; this mock supplies that boundary.
  const stage = { ownerDocument: document as unknown as Document } as unknown as HTMLElement;
  const errors: unknown[] = [], actions: ObjectAction[] = []; let state = selectionState(initial);
  let binding: ReturnType<typeof createObjectControlBinding>;
  let actionImplementation: (action: ObjectAction) => unknown = action => {
    state = { ...state, committed: reduceObjectSelection(state.committed ?? initial, action), pending: false };
    state.desired = state.committed ?? initial; binding.publish(state); return true;
  };
  mutate({ lensInputs, settingInputs, stage, document, lensRoot });
  binding = createObjectControlBinding({ stage, controls, initialSelection: initial, getState: () => state,
    onAction(action) { actions.push(action); return actionImplementation(action); }, onError: error => errors.push(error) } satisfies ObjectControlBindingOptions);
  return { binding, lensInputs, settingInputs, lensRoot, settingsRoot, motion, surfaceLabels, heliosphere, illustrationModels, errors, actions, initial,
    setState(next: ObjectSelectionState) { state = next; binding.publish(state); }, state: () => state,
    onAction(callback: (action: ObjectAction) => unknown) { actionImplementation = callback; },
    ready() { state = { ...state, committed: initial, desired: initial, pending: false }; binding.setReady(); },
  };
}

for (const object of SCENE_OBJECTS) test(`${object.id}: one binder consumes every actual control and owns no shell preference listener`, async () => {
  const {controls} = parsePreparedObjectRuntime(await loadObjectTestDefinition(object.id));
  const h = harness(controls);
  assert.ok(h.lensInputs.every(input => !input.disabled));
  assert.ok(h.settingInputs.filter(input => !["motion", "surfaceLabels", "heliosphere", "illustrationModels"].includes(input.name)).every(input => input.disabled));
  assert.equal(h.motion.disabled, false); assert.equal(h.surfaceLabels.disabled, false);
  assert.equal(h.illustrationModels.disabled, false);
  assert.equal(h.heliosphere.disabled, false);
  h.lensInputs[0]?.emit("click"); assert.equal(h.actions.length, 0);
  h.ready();
  for (const input of h.lensInputs) input.emit("click");
  for (const control of controls.settings?.controls ?? []) {
    const input = h.settingInputs.find(input => input.name === control.name); assert.ok(input);
    if (control.kind === "toggle") { input.checked = !input.checked; input.emit("change"); }
    else {
      for (const state of objectCycleStates(control)) {
        input.value = String(state.value); input.emit("input");
        assert.equal(input.dataset.state, state.label);
      }
    }
  }
  const count = h.actions.length;
  h.motion.emit("change"); h.surfaceLabels.emit("change"); h.heliosphere.emit("change"); h.illustrationModels.emit("change");
  assert.equal(h.actions.length, count);
  assert.deepEqual(h.errors, []);
  assert.equal(h.binding.stats().listenerCount, (controls.lenses?.controls.length ?? 0) + (controls.settings?.controls.length ?? 0));
  h.binding.destroy(); h.binding.destroy(); h.lensInputs[0]?.emit("click");
  assert.equal(h.actions.length, count); assert.equal(h.binding.stats().listenerCount, 0);
  assert.equal(h.lensRoot.classList.contains("is-loading"), false);
  assert.equal(h.settingsRoot.classList.contains("is-loading"), false);
  assert.equal(h.settingsRoot.attributes["aria-busy"], "false");
});

test('native dataset submission is intercepted only while its runtime can switch in place', () => {
  const h = harness();
  const button = h.lensInputs[0];
  const click = () => {
    const event = new Event('click', { cancelable: true }); button.dispatchEvent(event); return event.defaultPrevented;
  };
  assert.equal(click(), false); assert.equal(button.disabled, false);
  h.ready(); assert.equal(click(), true); assert.equal(h.actions.length, 1);
  h.binding.setReady(false); assert.equal(click(), false); assert.equal(button.disabled, false);
  h.binding.destroy(); assert.equal(click(), false); assert.equal(button.disabled, false);
});

test("duplicate, missing, undeclared and incorrectly rendered controls are rejected before binding", () => {
  assert.throws(() => harness(moonControls, ({ lensInputs }) => lensInputs.push(lensInputs[0])), /actual package/);
  assert.throws(() => harness(moonControls, ({ lensInputs }) => lensInputs.pop()), /actual package/);
  assert.throws(() => harness(moonControls, ({ settingInputs }) => settingInputs.push(new Input({ name: "invented" }))), /actual package/);
  assert.throws(() => harness(moonControls, ({ settingInputs }) => { settingInputs[0].type = "text"; }), /wrong input/);
  assert.throws(() => harness(moonControls, ({ settingInputs }) => { settingInputs[0].max = "5"; }), /declared states/);
});
test("pending controls project desired values while pressed lenses remain committed; failure restores current committed UI", async () => {
  const h = harness(saturnControls); h.ready(); let reject: (error: Error) => void = () => { throw new Error("missing rejection"); };
  h.onAction(action => {
    const desired = reduceObjectSelection(h.state().desired, action);
    h.setState({ ...h.state(), desired, pending: true });
    return new Promise((_, fail) => { reject = fail; });
  });
  const rings = h.settingInputs.find(input => input.name === "rings"); assert.ok(rings); rings.checked = false; rings.emit("change");
  const selectedLens = h.lensInputs.find(input => input.value === h.initial.lensId); assert.ok(selectedLens);
  assert.equal(rings.checked, false); assert.equal(selectedLens.attributes["aria-pressed"], "true");
  assert.equal(h.lensRoot.classList.contains("is-loading"), true);
  assert.equal(h.settingsRoot.classList.contains("is-loading"), true);
  assert.equal(h.settingsRoot.attributes["aria-busy"], "true"); assert.equal(rings.disabled, false);
  h.setState({ ...h.state(), desired: h.initial, committed: h.initial, pending: false, error: "decode" });
  reject(new Error("decode")); await flush();
  assert.equal(rings.checked, true); assert.equal(h.lensRoot.classList.contains("is-loading"), false);
  assert.equal(h.settingsRoot.classList.contains("is-loading"), false);
  assert.equal(h.settingsRoot.attributes["aria-busy"], "false");
  assert.equal(h.errors.length, 1); h.binding.destroy();
});
test("the same declared lens controls can project simultaneous material and interior pressed states", () => {
  const h = harness(saturnControls); h.ready();
  h.setState({ ...h.state(), plan: { required: [], prewarm: [], materials: {}, pressedLenses: ["methane", "cross-section"] } });
  assert.deepEqual(h.lensInputs.filter(input => input.attributes["aria-pressed"] === "true").map(input => input.value), ["methane", "cross-section"]);
  h.binding.destroy();
});
test("invalid range events restore the selected rate, and a late failure cannot update a disposed binding", async () => {
  const h = harness(); h.ready(); const speed = h.settingInputs.find(input => input.name === "speed"); assert.ok(speed);
  speed.value = "9"; speed.emit("input");
  assert.equal(speed.value, "1"); assert.equal(h.actions.length, 0); assert.equal(h.errors.length, 1);
  let reject: (error: Error) => void = () => { throw new Error("missing rejection"); }; h.onAction(() => new Promise<void>((_, fail) => { reject = fail; }));
  h.lensInputs[1].emit("click"); h.binding.destroy(); reject(new Error("late")); await flush();
  assert.equal(h.errors.length, 1); assert.equal(h.binding.stats().destroyed, true);
});
test("speed readiness never grants Motion permission and disposal blocks the shell's range", () => {
  const h = harness(); const speed = h.settingInputs.find(input => input.name === "speed"); assert.ok(speed);
  assert.equal(speed.dataset.runtimeReady, "false"); assert.equal(speed.disabled, true);
  h.ready(); assert.equal(speed.dataset.runtimeReady, "true"); assert.equal(speed.disabled, true);
  // The existing shell owner republishes after the router observes readiness.
  speed.disabled = false; h.binding.publish(h.state()); assert.equal(speed.disabled, false);
  h.binding.destroy(); assert.equal(speed.dataset.runtimeReady, "false"); assert.equal(speed.disabled, true);
});

test("one failed native listener removal does not stop the rest of control cleanup", () => {
  const h = harness(); h.ready();
  h.lensInputs[0].removeEventListener = () => { throw new Error("native listener cleanup"); };
  assert.throws(() => h.binding.destroy(), AggregateError);
  assert.equal(h.binding.stats().listenerCount, 0);
  assert.ok(h.lensInputs.every(input => !input.disabled));
  assert.equal(h.lensRoot.attributes["aria-busy"], "false");
  h.lensInputs[0].emit("click"); assert.equal(h.actions.length, 0);
  h.binding.destroy();
});


test("prepared dataset details follow committed selection through pending work", () => {
  const ids = moonControls.lenses?.controls.slice(0, 2).map(lens => lens.id) ?? []; assert.equal(ids.length, 2);
  const legends = ids.map(() => ({ hidden: true }));
  const h = harness(moonControls, ({ document }) => {
    const lookup = document.getElementById;
    document.getElementById = id => legends[ids.indexOf(id)] ?? lookup(id);
  });
  h.ready(); assert.deepEqual(legends.map(legend => legend.hidden), [false, true]);
  const desired = { ...h.initial, lensId: ids[1] };
  h.setState({ ...h.state(), committed: h.initial, desired, pending: true, plan: null });
  assert.deepEqual(legends.map(legend => legend.hidden), [false, true]);
  h.setState({ ...h.state(), committed: desired, desired, pending: false, plan: null });
  assert.deepEqual(legends.map(legend => legend.hidden), [true, false]);
  h.binding.destroy();
});


test("a preceding focused galaxy lens bank cannot replace the mounted body's controls", () => {
  const focusInput = new Input({ name: "focusLens", value: "vista-infrared", tagName: "BUTTON", type: "button" });
  const focusRoot = new Root([focusInput]);
  const h = harness(moonControls, ({ document }) => {
    const query = document.querySelector;
    document.querySelector = selector => selector === ".object-lenses" ? focusRoot : query(selector);
  });
  h.ready();
  assert.ok(moonControls.lenses);
  assert.deepEqual(h.binding.stats().lensIds, moonControls.lenses.controls.map(lens => lens.id));
  assert.equal(focusInput.disabled, false);
  focusInput.emit("click"); assert.equal(h.actions.length, 0);
  h.lensInputs[0].emit("click"); assert.equal(h.actions.length, 1);
  h.binding.destroy(); assert.equal(focusInput.disabled, false);
});
