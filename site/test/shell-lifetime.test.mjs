import assert from "node:assert/strict";
import test from "node:test";
import { mountPlanetShell } from "../planet-shell-client.mjs";
import context from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };

class Element extends EventTarget {
  dataset = {}; children = []; value = ""; style = { removeProperty() {}, setProperty() {} };
  classList = { remove() {}, toggle() {}, contains() { return false; } };
  checked = false; hidden = false; open = false; id = ""; attributes = new Map(); listeners = new Set();
  selectors = new Map();
  querySelector(selector) { return this.selectors.get(selector) ?? null; }
  querySelectorAll(selector) { return this.selectors.get(selector) ?? []; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    this.listeners.add(listener);
    options?.signal?.addEventListener("abort", () => this.listeners.delete(listener), { once: true });
  }
}
function fixture() {
  const selectors = new Map();
  const elements = [];
  for (const selector of [".planet-drawer-content", ".planet-sidebar", ".planet-sidebar-toggle",
    ".planet-sidebar-search", ".planet-sidebar-search-card", ".planet-sidebar-view-all",
    ".planet-information-panel", ".planet-object-browser", ".planet-object-empty",
    ".planet-sheet-handle", ".planet-settings-panel", ".planet-settings-action",
    ".explorer-rail-explore", ".explorer-rail-about", ".explorer-about-panel",
    ".planet-motion-setting", ".planet-sky-contrast-setting"]) {
    const element = new Element();
    selectors.set(selector, element); elements.push(element);
  }
  const drawer = selectors.get(".planet-drawer-content");
  drawer.selectors.set(".planet-sheet-handle", selectors.get(".planet-sheet-handle"));
  drawer.selectors.set(".planet-information-panel", selectors.get(".planet-information-panel"));
  const item = new Element();
  selectors.get(".planet-object-browser").selectors.set(".planet-object-item", [item]);
  const row = new Element(), explanation = new Element();
  explanation.id = "fixture-motion-blocked";
  row.selectors.set(".planet-motion-blocked", explanation);
  selectors.get(".planet-motion-setting").closest = () => row;
  const documentTarget = new Element();
  documentTarget.selectors = selectors;
  documentTarget.body = new Element();
  documentTarget.documentElement = new Element();
  const windowTarget = new Element();
  for (const name of ["HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLDetailsElement", "HTMLLIElement"])
    windowTarget[name] = Element;
  const frames = new Map();
  windowTarget.requestAnimationFrame = (callback) => { frames.set(1, callback); return 1; };
  windowTarget.cancelAnimationFrame = (id) => frames.delete(id);
  windowTarget.localStorage = { getItem() { return null; } };
  const changes = [];
  return { documentTarget, windowTarget, selectors, elements, frames, row, explanation, changes,
    mount: () => mountPlanetShell({ objectId: "fixture", documentTarget, windowTarget, onMotionChange: (value) => changes.push(value) }) };
}

test("shell with no optional controls keeps Motion/high contrast and accessible blocked intent", () => {
  const f = fixture(), shell = f.mount();
  const motion = f.selectors.get(".planet-motion-setting");
  const contrast = f.selectors.get(".planet-sky-contrast-setting");
  assert.equal(contrast.checked, false, 'High contrast starts off');
  assert.equal(f.documentTarget.body.dataset.skyContrast, 'standard');
  shell.setPlaybackState({ motionRequested: true, reason: "reduced-motion" });
  assert.equal(motion.checked, true);
  assert.equal(f.explanation.hidden, false);
  assert.equal(motion.attributes.get("aria-describedby"), f.explanation.id);
  assert.deepEqual(f.changes, [], "Rendering policy must not dispatch another intent event");
  shell.setPlaybackState({ motionRequested: true, reason: "allowed" });
  assert.equal(f.explanation.hidden, true);
  assert.equal(motion.attributes.has("aria-describedby"), false);
  motion.checked = false; motion.dispatchEvent(new Event("change"));
  assert.deepEqual(f.changes, [false]);
  contrast.checked = true; contrast.dispatchEvent(new Event("change"));
  assert.equal(f.documentTarget.body.dataset.skyContrast, "high");
  shell.destroy(); shell.destroy();
  shell.setMotionEnabled(true);
  shell.setPlaybackState({ motionRequested: true, reason: "allowed" });
  assert.equal(motion.checked, false);
  assert.deepEqual(f.changes, [false]);
  assert.equal(f.frames.size, 0);
  assert.ok(f.elements.every((element) => element.listeners.size === 0));
  motion.checked = true; motion.dispatchEvent(new Event("change"));
  assert.deepEqual(f.changes, [false]);
});

test("failed shell construction cleans earlier controllers and their scheduled work", () => {
  const f = fixture();
  f.selectors.delete(".planet-sky-contrast-setting");
  assert.throws(f.mount, /settings controls are incomplete/);
  assert.equal(f.frames.size, 0);
  assert.ok(f.elements.every((element) => element.listeners.size === 0));
  assert.equal(f.windowTarget.listeners.size, 0);
  assert.equal(f.documentTarget.listeners.size, 0);
});

test('object content replacement retains shell controls and input state without accumulating listeners', () => {
  const f = fixture(), shell = f.mount();
  const search = f.selectors.get('.planet-sidebar-search');
  const drawer = f.selectors.get('.planet-drawer-content');
  const motion = f.selectors.get('.planet-motion-setting');
  const contrast = f.selectors.get('.planet-sky-contrast-setting');
  motion.checked = true; motion.dispatchEvent(new Event('change'));
  contrast.checked = true; contrast.dispatchEvent(new Event('change'));
  const searchListeners = search.listeners.size, drawerListeners = drawer.listeners.size;
  for (const id of ['second', 'third', 'first']) {
    shell.setObject({ id, name: id, apply() {} });
    assert.equal(f.selectors.get('.planet-sidebar-search'), search);
    assert.equal(f.selectors.get('.planet-drawer-content'), drawer);
    assert.equal(search.value, id);
    assert.equal(search.listeners.size, searchListeners);
    assert.equal(drawer.listeners.size, drawerListeners);
    assert.equal(motion.checked, true);
    assert.equal(contrast.checked, true);
    assert.equal(f.documentTarget.body.dataset.skyContrast, 'high');
  }
  assert.deepEqual(f.changes, [true]);
  shell.destroy();
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test("Motion cannot enable Speed before the shared runtime is ready or after it retires", () => {
  const f = fixture(), speed = new Element();
  speed.dataset.runtimeReady = "false";
  f.selectors.set('.planet-speed-setting[type="range"][name="speed"]', speed);
  const shell = f.mount();
  shell.setPlaybackState({ motionRequested: true, reason: "loading" });
  assert.equal(speed.disabled, true);
  speed.dataset.runtimeReady = "true";
  shell.setPlaybackState({ motionRequested: true, reason: "allowed" });
  assert.equal(speed.disabled, false);
  shell.setPlaybackState({ motionRequested: false, reason: "motion-off" });
  assert.equal(speed.disabled, true);
  speed.dataset.runtimeReady = "false";
  shell.setPlaybackState({ motionRequested: true, reason: "loading" });
  assert.equal(speed.disabled, true);
  shell.destroy();
});

test('camera scale changes retained overview content without moving the camera and search opens matching body groups', () => {
  const f = fixture(), browser = f.selectors.get('.planet-object-browser');
  const galaxy = new Element(), system = new Element();
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-solar-system-results]', system);
  const groups = ['planet', 'satellite'].map(type => {
    const group = new Element(), item = new Element();
    item.dataset = { objectName: type === 'planet' ? 'earth' : 'moon', objectSystemName: 'solar system',
      objectClassification: type, objectClassificationName: type === 'planet' ? 'planet' : 'moon' };
    group.selectors.set('.planet-object-item', [item]); group.open = type === 'planet';
    return group;
  });
  browser.selectors.set('[data-object-type-group]', groups);
  browser.selectors.set('.planet-object-item', groups.flatMap(group => group.querySelectorAll('.planet-object-item')));
  const shell = f.mount(), search = f.selectors.get('.planet-sidebar-search'), listeners = new Set();
  let world = { pose: { positionM: [0, 0, context.camera.maximumDistanceM] } };
  const before = structuredClone(world);
  shell.setOverview(true);
  shell.setCamera({ navigation: { capture: () => world,
    subscribe(callback) { listeners.add(callback); callback(world); return () => listeners.delete(callback); },
  } });
  assert.equal(search.value, 'Milky Way');
  assert.equal(galaxy.hidden, false); assert.equal(system.hidden, true);
  assert.deepEqual(world, before, 'Only the sidebar context changes');
  world = { pose: { positionM: [0, 0, context.volume.fadeStartDistanceM * .9] } };
  for (const callback of listeners) callback(world);
  assert.equal(search.value, 'Solar System'); assert.equal(system.hidden, false); assert.equal(galaxy.hidden, true);
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  assert.equal(groups[0].hidden, true); assert.equal(groups[1].hidden, false); assert.equal(groups[1].open, true);
  search.value = 'Solar System'; search.dispatchEvent(new Event('input'));
  assert.equal(groups[0].open, true); assert.equal(groups[1].open, false, 'Search preserves the previous collapsed state');
  shell.destroy(); assert.equal(listeners.size, 0);
});
