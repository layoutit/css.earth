import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANET_SHADOW_DEFAULT,
  PLANET_SPEED_STATES,
  bindSpeedControl,
  createPlanetFeatureControls,
} from "./planet-feature-controls.mjs";
import { createSceneLifetime } from "./scene-lifetime.mjs";

class Input extends EventTarget {
  dataset = {};
  attributes = {};
  disabled = false;
  checked = false;
  value = "1";
  setAttribute(key, value) { this.attributes[key] = value; }
}

test("speed binding owns the stepped range, keeps playback permission separate, and removes its listener", () => {
  const lifetime = createSceneLifetime();
  const input = new Input();
  const rates = [];
  const binding = bindSpeedControl({ input, lifetime, onChange: (rate) => rates.push(rate), onError: assert.fail });
  assert.equal(input.disabled, true);
  input.dispatchEvent(new Event("input"));
  assert.deepEqual(rates, []);
  binding.setEnabled(true);
  for (const [value, label] of [[2, "fast"], [3, "fastest"], [4, "superfast"], [0, "off"], [1, "normal"]]) {
    input.value = String(value);
    input.dispatchEvent(new Event("input"));
    assert.equal(input.dataset.state, label);
    assert.equal(input.attributes["aria-label"], `Speed: ${label}`);
  }
  assert.deepEqual(rates, [2, 3, 4, 0, 1]);
  assert.deepEqual(binding.state(), { speed: 1 });
  lifetime.destroy();
  binding.setEnabled(true);
  input.value = "2";
  input.dispatchEvent(new Event("input"));
  assert.equal(input.disabled, true);
  assert.deepEqual(rates, [2, 3, 4, 0, 1]);
});

test("a failed speed publication reports fatal error without advancing displayed state", () => {
  const lifetime = createSceneLifetime();
  const input = new Input();
  const error = new Error("publication");
  const errors = [];
  const binding = bindSpeedControl({ input, lifetime, onChange() { throw error; }, onError(value) { errors.push(value); lifetime.destroy(); } });
  binding.setEnabled(true);
  input.value = "2";
  input.dispatchEvent(new Event("input"));
  assert.deepEqual(errors, [error]);
  assert.equal(input.dataset.state, "normal");
  assert.equal(input.value, "1");
  assert.equal(input.disabled, true);
});

test("invalid initial speed fails before attaching a listener or cleanup owner", () => {
  const lifetime = createSceneLifetime();
  let listeners = 0;
  const input = new Input();
  input.addEventListener = () => { listeners += 1; };
  for (const initialValue of [-1, 1.5, "1", Infinity, NaN]) {
    assert.throws(() => bindSpeedControl({ input, initialValue, lifetime,
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
  const stage = new Element(), root = new Element(), speed = new Input();
  const inputs = { rings: new Input(), shadows: new Input() };
  root.querySelector = (selector) => selector.includes('"speed"') ? speed
    : selector.includes('"rings"') ? inputs.rings : inputs.shadows;
  const previous = new Map();
  for (const [name, value] of Object.entries({ HTMLElement: Element, HTMLInputElement: Input,
    document: { querySelector: () => root } })) {
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
  speed.value = "2";
  speed.dispatchEvent(new Event("input"));
  assert.equal(first.playbackRate, 2);
  controls.bindRuntime({ animations: [later] });
  assert.equal(later.playbackRate, 2);
  speed.value = "0";
  speed.dispatchEvent(new Event("input"));
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
  speed.value = "3";
  speed.dispatchEvent(new Event("input"));
  assert.equal(retired.playbackRate, 99);
  assert.equal(off.playbackRate, 0);
  assert.equal(speed.disabled, true);
});

test("defaults the shared retained-overlay shadow control to off", () => {
  assert.equal(PLANET_SHADOW_DEFAULT, false);
});

test("publishes the established five-state planet speed policy", () => {
  assert.deepEqual(PLANET_SPEED_STATES.map(({ label, value }) => [label, value]), [
    ["off", 0], ["normal", 1], ["fast", 2], ["fastest", 3], ["superfast", 4],
  ]);
});
