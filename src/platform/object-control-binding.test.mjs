import assert from "node:assert/strict";
import test from "node:test";
import { OBJECTS } from "../../site/objects.mjs";
import { createObjectControlBinding } from "./object-control-binding.mjs";
import { initialObjectSelection, reduceObjectSelection, objectCycleStates } from "./object-runtime-contract.mjs";
import { objectControls as moonControls } from "../planets/moon/site/control-content.mjs";
import { objectControls as saturnControls } from "../planets/saturn/site/control-content.mjs";
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
class Input extends EventTarget {
  constructor(fields = {}) { super(); Object.assign(this, { name: "", value: "", dataset: {}, disabled: false, attributes: {}, tagName: "INPUT", type: "checkbox", min: "0", max: "4", step: "1" }, fields); }
  setAttribute(key, value) { this.attributes[key] = value; }
  emit(type) { this.dispatchEvent(new Event(type)); }
}
function root(inputs) {
  const classes = new Set();
  return { querySelectorAll: () => inputs, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; },
    classList: { toggle(key, on) { if (on) classes.add(key); else classes.delete(key); }, remove: key => classes.delete(key), contains: key => classes.has(key) } };
}
function harness(controls = moonControls, mutate = () => {}) {
  const initial = initialObjectSelection(controls);
  const lensInputs = controls.lenses.controls.map(lens => new Input({ name: "lens", value: lens.id, tagName: "BUTTON", type: "button" }));
  const settingInputs = controls.settings.controls.map(control => new Input({ name: control.name,
    type: control.kind === "toggle" ? "checkbox" : "range", checked: control.checked, value: String(initial[control.name]) }));
  const motion = new Input({ name: "motion" }), contrast = new Input({ name: "skyContrast" });
  settingInputs.push(motion, contrast);
  const lensRoot = root(lensInputs), settingsRoot = root(settingInputs);
  const stage = { ownerDocument: { querySelector: selector => selector === ".planet-lenses" ? lensRoot : settingsRoot } };
  const errors = [], actions = []; let state = { committed: null, desired: initial, plan: null, pending: true };
  let actionImplementation = action => {
    state = { ...state, committed: reduceObjectSelection(state.committed ?? initial, action), pending: false };
    state.desired = state.committed; binding.publish(state); return true;
  };
  mutate({ lensInputs, settingInputs, stage, lensRoot });
  const binding = createObjectControlBinding({ stage, controls, initialSelection: initial, getState: () => state,
    onAction(action) { actions.push(action); return actionImplementation(action); }, onError: error => errors.push(error) });
  return { binding, lensInputs, settingInputs, lensRoot, settingsRoot, motion, contrast, errors, actions, initial,
    setState(next) { state = next; binding.publish(state); }, state: () => state,
    onAction(callback) { actionImplementation = callback; },
    ready() { state = { ...state, committed: initial, desired: initial, pending: false }; binding.setReady(); },
  };
}

for (const object of OBJECTS) test(`${object.id}: one binder consumes every actual control and owns no shell preference listener`, async () => {
  const { objectControls: controls } = await import(`../planets/${object.id}/site/control-content.mjs`);
  const h = harness(controls);
  assert.ok([...h.lensInputs, ...h.settingInputs.filter(input => !["motion", "skyContrast"].includes(input.name))].every(input => input.disabled));
  assert.equal(h.motion.disabled, false); assert.equal(h.contrast.disabled, false);
  h.lensInputs[0].emit("click"); assert.equal(h.actions.length, 0);
  h.ready();
  for (const input of h.lensInputs) input.emit("click");
  for (const control of controls.settings.controls) {
    const input = h.settingInputs.find(input => input.name === control.name);
    if (control.kind === "toggle") { input.checked = !input.checked; input.emit("change"); }
    else {
      for (const state of objectCycleStates(control)) {
        input.value = String(state.value); input.emit("input");
        assert.equal(input.dataset.state, state.label);
      }
    }
  }
  const count = h.actions.length;
  h.motion.emit("change"); h.contrast.emit("change"); assert.equal(h.actions.length, count);
  assert.deepEqual(h.errors, []);
  assert.equal(h.binding.stats().listenerCount, controls.lenses.controls.length + controls.settings.controls.length);
  h.binding.destroy(); h.binding.destroy(); h.lensInputs[0].emit("click");
  assert.equal(h.actions.length, count); assert.equal(h.binding.stats().listenerCount, 0);
  assert.equal(h.lensRoot.classList.contains("is-loading"), false);
  assert.equal(h.settingsRoot.classList.contains("is-loading"), false);
  assert.equal(h.settingsRoot.attributes["aria-busy"], "false");
});

test("duplicate, missing, undeclared and incorrectly rendered controls are rejected before binding", () => {
  assert.throws(() => harness(moonControls, ({ lensInputs }) => lensInputs.push(lensInputs[0])), /actual package/);
  assert.throws(() => harness(moonControls, ({ lensInputs }) => lensInputs.pop()), /actual package/);
  assert.throws(() => harness(moonControls, ({ settingInputs }) => settingInputs.push(new Input({ name: "invented" }))), /actual package/);
  assert.throws(() => harness(moonControls, ({ settingInputs }) => { settingInputs[0].type = "text"; }), /wrong input/);
  assert.throws(() => harness(moonControls, ({ settingInputs }) => { settingInputs[0].max = "5"; }), /declared states/);
});
test("pending controls project desired values while pressed lenses remain committed; failure restores current committed UI", async () => {
  const h = harness(saturnControls); h.ready(); let reject;
  h.onAction(action => {
    const desired = reduceObjectSelection(h.state().desired, action);
    h.setState({ ...h.state(), desired, pending: true });
    return new Promise((_, fail) => { reject = fail; });
  });
  const rings = h.settingInputs.find(input => input.name === "rings"); rings.checked = false; rings.emit("change");
  assert.equal(rings.checked, false); assert.equal(h.lensInputs.find(input => input.value === h.initial.lensId).attributes["aria-pressed"], "true");
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
  h.setState({ ...h.state(), plan: { pressedLenses: ["methane", "cross-section"] } });
  assert.deepEqual(h.lensInputs.filter(input => input.attributes["aria-pressed"] === "true").map(input => input.value), ["methane", "cross-section"]);
  h.binding.destroy();
});
test("invalid range events restore the selected rate, and a late failure cannot update a disposed binding", async () => {
  const h = harness(); h.ready(); const speed = h.settingInputs.find(input => input.name === "speed");
  speed.value = "9"; speed.emit("input");
  assert.equal(speed.value, "1"); assert.equal(h.actions.length, 0); assert.equal(h.errors.length, 1);
  let reject; h.onAction(() => new Promise((_, fail) => { reject = fail; }));
  h.lensInputs[1].emit("click"); h.binding.destroy(); reject(new Error("late")); await flush();
  assert.equal(h.errors.length, 1); assert.equal(h.binding.stats().destroyed, true);
});
test("speed readiness never grants Motion permission and disposal blocks the shell's range", () => {
  const h = harness(); const speed = h.settingInputs.find(input => input.name === "speed");
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
  assert.ok(h.lensInputs.every(input => input.disabled));
  assert.equal(h.lensRoot.attributes["aria-busy"], "false");
  h.lensInputs[0].emit("click"); assert.equal(h.actions.length, 0);
  h.binding.destroy();
});


test("prepared lens legends follow committed selection through pending work", () => {
  const ids = moonControls.lenses.controls.slice(0, 2).map(lens => lens.id);
  const legends = ids.map(id => ({ dataset: { lensLegend: id }, hidden: true }));
  const h = harness(moonControls, ({ lensRoot, lensInputs }) => {
    lensRoot.querySelectorAll = selector => selector === "[data-lens-legend]" ? legends : lensInputs;
  });
  h.ready(); assert.deepEqual(legends.map(legend => legend.hidden), [false, true]);
  const desired = { ...h.initial, lensId: ids[1] };
  h.setState({ committed: h.initial, desired, pending: true, plan: null });
  assert.deepEqual(legends.map(legend => legend.hidden), [false, true]);
  h.setState({ committed: desired, desired, pending: false, plan: null });
  assert.deepEqual(legends.map(legend => legend.hidden), [true, false]);
  h.binding.destroy();
});
