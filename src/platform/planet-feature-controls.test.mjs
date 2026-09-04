import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANET_SHADOW_DEFAULT,
  PLANET_SPEED_STATES,
  bindSpeedControl,
  createPlanetFeatureControls,
} from "./planet-feature-controls.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";

class Button extends EventTarget {
  dataset = {};
  attributes = {};
  disabled = false;
  setAttribute(key, value) { this.attributes[key] = value; }
}

test("speed binding owns the complete cycle, keeps playback permission separate, and removes its listener", () => {
  const lifetime = createSceneLifetime();
  const button = new Button();
  const rates = [];
  const binding = bindSpeedControl({ button, lifetime, onChange: (rate) => rates.push(rate), onError: assert.fail });
  assert.equal(button.disabled, true);
  button.dispatchEvent(new Event("click"));
  assert.deepEqual(rates, []);
  binding.setEnabled(true);
  for (const label of ["fast", "fastest", "superfast", "off", "normal"]) {
    button.dispatchEvent(new Event("click"));
    assert.equal(button.dataset.state, label);
    assert.equal(button.attributes["aria-label"], `Speed: ${label}`);
  }
  assert.deepEqual(rates, [2, 3, 4, 0, 1]);
  assert.deepEqual(binding.state(), { speed: 1 });
  lifetime.destroy();
  binding.setEnabled(true);
  button.dispatchEvent(new Event("click"));
  assert.equal(button.disabled, true);
  assert.deepEqual(rates, [2, 3, 4, 0, 1]);
});

test("a failed speed publication reports fatal error without advancing displayed state", () => {
  const lifetime = createSceneLifetime();
  const button = new Button();
  const error = new Error("publication");
  const errors = [];
  const binding = bindSpeedControl({ button, lifetime, onChange() { throw error; }, onError(value) { errors.push(value); lifetime.destroy(); } });
  binding.setEnabled(true);
  button.dispatchEvent(new Event("click"));
  assert.deepEqual(errors, [error]);
  assert.equal(button.dataset.state, "normal");
  assert.equal(button.disabled, true);
});

test("invalid initial speed fails before attaching a listener or cleanup owner", () => {
  const lifetime = createSceneLifetime();
  let listeners = 0;
  const button = new Button();
  button.addEventListener = () => { listeners += 1; };
  for (const initialValue of [-1, 1.5, "1", Infinity, NaN]) {
    assert.throws(() => bindSpeedControl({ button, initialValue, lifetime,
      onChange: assert.fail, onError: assert.fail }), /known rate/);
  }
  assert.equal(listeners, 0);
  assert.equal(lifetime.stats().ownerCount, 0);
  lifetime.destroy();
});

test("later animation handles inherit current speed without changing playback permission", (t) => {
  class Element extends EventTarget {
    classes = new Set();
    classList = {
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      remove: (name) => this.classes.delete(name),
    };
  }
  class Input extends EventTarget { checked = false; }
  const stage = new Element(), root = new Element(), button = new Button();
  const inputs = { rings: new Input(), shadows: new Input() };
  root.querySelector = (selector) => selector.includes('"speed"') ? button
    : selector.includes('"rings"') ? inputs.rings : inputs.shadows;
  const previous = new Map();
  for (const [name, value] of Object.entries({ HTMLElement: Element, HTMLInputElement: Input,
    HTMLButtonElement: Button, document: { querySelector: () => root } })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const lifetime = createSceneLifetime();
  t.after(() => lifetime.destroy());
  const controls = createPlanetFeatureControls({ stage, lifetime, onError: assert.fail,
    classes: { rings: "hide-rings", shadows: "hide-shadows" } });
  const animation = () => ({ playbackRate: 99, playState: "paused", currentTime: 24,
    play: () => assert.fail("Rate binding must not start playback"),
    pause: () => assert.fail("Rate binding must not own playback permission") });
  const first = animation(), later = animation(), off = animation();
  controls.bindRuntime({ animations: [first] });
  assert.equal(first.playbackRate, 1);
  button.dispatchEvent(new Event("click"));
  assert.equal(first.playbackRate, 2);
  controls.bindRuntime({ animations: [later] });
  assert.equal(later.playbackRate, 2);
  for (let count = 0; count < 3; count += 1) button.dispatchEvent(new Event("click"));
  assert.deepEqual(controls.optionsState(), { speed: 0 });
  controls.bindRuntime({ animations: [off] });
  assert.equal(off.playbackRate, 0);
  for (const handle of [first, later, off]) {
    assert.equal(handle.playState, "paused");
    assert.equal(handle.currentTime, 24);
  }
  lifetime.destroy();
  const retired = animation();
  controls.bindRuntime({ animations: [retired] });
  button.dispatchEvent(new Event("click"));
  assert.equal(retired.playbackRate, 99);
  assert.equal(off.playbackRate, 0);
  assert.equal(button.disabled, true);
});

test("defaults the shared retained-overlay shadow control to off", () => {
  assert.equal(PLANET_SHADOW_DEFAULT, false);
});

test("publishes the established five-state planet speed policy", () => {
  assert.deepEqual(PLANET_SPEED_STATES.map(({ label, value }) => [label, value]), [
    ["off", 0], ["normal", 1], ["fast", 2], ["fastest", 3], ["superfast", 4],
  ]);
});
