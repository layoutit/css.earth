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
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, options);
    this.listeners.add(listener);
    options?.signal?.addEventListener("abort", () => this.listeners.delete(listener), { once: true });
  }
}
function fixture(options = {}) {
  const selectors = new Map();
  const elements = [];
  for (const selector of [".planet-drawer-content", ".planet-sidebar", ".planet-sidebar-collapse",
    ".planet-sidebar-search", ".planet-sidebar-search-card", ".planet-sidebar-view-all",
    ".planet-information-panel", ".planet-object-browser", ".planet-object-empty",
    ".planet-sheet-handle", ".planet-settings-panel", ".planet-settings-action",
    ".explorer-rail-explore", ".explorer-rail-about", ".explorer-about-panel",
    ".planet-motion-setting", ".planet-sky-contrast-setting", ".planet-heliosphere-setting", ".planet-asteroid-orbits-setting", ".planet-asteroid-labels-setting"]) {
    const element = new Element();
    selectors.set(selector, element); elements.push(element);
  }
  const drawer = selectors.get(".planet-drawer-content");
  drawer.selectors.set(".planet-sheet-handle", selectors.get(".planet-sheet-handle"));
  drawer.selectors.set(".planet-information-panel", selectors.get(".planet-information-panel"));
  const item = new Element();
  selectors.get(".planet-object-browser").selectors.set(".planet-object-item", [item]);
  const tabs = ['all', 'planet', 'satellite', 'asteroid'].map(type => {
    const tab = new Element(); tab.dataset.objectTab = type; tab.id = `object-tab-${type}`;
    tab.selectors.set('.planet-object-tab-count', new Element()); elements.push(tab);
    return tab;
  });
  selectors.get('.planet-object-browser').selectors.set('[data-object-tab]', tabs);
  selectors.get('.planet-object-browser').selectors.set('#object-category-results', new Element());
  const row = new Element(), explanation = new Element();
  explanation.id = "fixture-motion-blocked";
  row.selectors.set(".planet-motion-blocked", explanation);
  selectors.get(".planet-motion-setting").closest = () => row;
  const documentTarget = new Element();
  documentTarget.selectors = selectors;
  documentTarget.body = new Element();
  documentTarget.documentElement = new Element();
  for (const tab of tabs) tab.focus = () => { documentTarget.activeElement = tab; };
  selectors.get('.planet-sidebar-search').focus = () => {
    documentTarget.activeElement = selectors.get('.planet-sidebar-search');
  };
  const windowTarget = new Element();
  windowTarget.Event = Event;
  for (const name of ["HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLDetailsElement", "HTMLLIElement"])
    windowTarget[name] = Element;
  const frames = new Map();
  windowTarget.requestAnimationFrame = (callback) => { frames.set(1, callback); return 1; };
  windowTarget.cancelAnimationFrame = (id) => frames.delete(id);
  windowTarget.localStorage = { getItem() { return null; } };
  const changes = [];
  return { documentTarget, windowTarget, selectors, elements, frames, row, explanation, changes,
    mount: () => mountPlanetShell({ objectId: "fixture", documentTarget, windowTarget, onMotionChange: (value) => changes.push(value), ...options }) };
}

test('retained catalogue groups follow filters and release their visibility observer', () => {
  const f = fixture(), browser = f.selectors.get('.planet-object-browser');
  const items = ['earth', 'mars'].map(objectName => {
    const item = new Element(); item.dataset = { objectName, objectSystemName: 'solar system', objectClassification: 'planet' };
    return item;
  });
  const groups = items.map(item => {
    const group = new Element(); group.selectors.set('.planet-object-item', [item]); return group;
  });
  browser.selectors.set('.planet-object-item', items);
  browser.selectors.set('.planet-object-chunk', groups);
  let observer;
  f.windowTarget.IntersectionObserver = class {
    observed = []; disconnected = false;
    constructor(callback, options) { observer = this; this.options = options; }
    observe(node) { this.observed.push(node); }
    disconnect() { this.disconnected = true; }
  };
  const shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  assert.equal(browser.inert, true);
  assert.deepEqual(observer.observed, groups);
  assert.equal(observer.options.root, browser.querySelector('#object-category-results'));
  search.value = 'mars'; search.dispatchEvent(new Event('input'));
  assert.deepEqual(groups.map(group => group.hidden), [true, false]);
  assert.deepEqual(groups.map(group => group.style.containIntrinsicBlockSize), ['0px', '20px']);
  assert.equal(browser.inert, false);
  assert.equal(f.selectors.get('.planet-information-panel').inert, true);
  search.value = 'Solar System'; search.dispatchEvent(new Event('input'));
  assert.deepEqual(groups.map(group => group.hidden), [false, false]);
  search.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
  assert.equal(browser.inert, true);
  assert.equal(f.selectors.get('.planet-information-panel').inert, false);
  shell.destroy();
  assert.equal(observer.disconnected, true);
});

test('Asteroids Orbits starts off and retains its independent preference across body navigation', () => {
  const changes = [], f = fixture({ onAsteroidOrbitsChange: value => changes.push(value) }), shell = f.mount();
  const toggle = f.selectors.get('.planet-asteroid-orbits-setting');
  assert.equal(toggle.checked, false);
  assert.equal(f.documentTarget.body.dataset.asteroidOrbits, 'off');
  for (const enabled of [true, false]) {
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change'));
    for (const id of ['itokawa', 'sun', 'saturn']) {
      shell.setObject({ id, name: id, apply() {} });
      assert.equal(toggle.checked, enabled);
      assert.equal(f.documentTarget.body.dataset.asteroidOrbits, enabled ? 'on' : 'off');
      assert.equal(f.selectors.get('.planet-heliosphere-setting').checked, false);
    }
  }
  assert.deepEqual(changes, [true, false]);
  shell.destroy();
  toggle.dispatchEvent(new Event('change'));
  assert.deepEqual(changes, [true, false]);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test('Asteroid Labels starts off and retains its independent preference across body navigation', () => {
  const changes = [], f = fixture({ onAsteroidLabelsChange: value => changes.push(value) }), shell = f.mount();
  const toggle = f.selectors.get('.planet-asteroid-labels-setting');
  assert.equal(toggle.checked, false);
  assert.equal(f.documentTarget.body.dataset.asteroidLabels, 'off');
  for (const enabled of [true, false]) {
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change'));
    for (const id of ['itokawa', 'sun', 'saturn']) {
      shell.setObject({ id, name: id, apply() {} });
      assert.equal(toggle.checked, enabled);
      assert.equal(f.documentTarget.body.dataset.asteroidLabels, enabled ? 'on' : 'off');
      assert.equal(f.selectors.get('.planet-heliosphere-setting').checked, false);
    }
  }
  assert.deepEqual(changes, [true, false]);
  shell.destroy();
  toggle.dispatchEvent(new Event('change'));
  assert.deepEqual(changes, [true, false]);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test("shell with no optional controls keeps Motion/high contrast and accessible blocked intent", () => {
  const f = fixture(), shell = f.mount();
  const motion = f.selectors.get(".planet-motion-setting");
  motion.setAttribute('aria-describedby', 'fixture-motion-description');
  const contrast = f.selectors.get(".planet-sky-contrast-setting");
  assert.equal(contrast.checked, false, 'High contrast starts off');
  assert.equal(f.selectors.get('.planet-heliosphere-setting').checked, false, 'Heliosphere starts off');
  assert.equal(f.documentTarget.body.dataset.skyContrast, 'standard');
  shell.setPlaybackState({ motionRequested: true, reason: "reduced-motion" });
  assert.equal(motion.checked, true);
  assert.equal(f.explanation.hidden, false);
  assert.equal(motion.attributes.get("aria-describedby"), `fixture-motion-description ${f.explanation.id}`);
  assert.deepEqual(f.changes, [], "Rendering policy must not dispatch another intent event");
  shell.setPlaybackState({ motionRequested: true, reason: "allowed" });
  assert.equal(f.explanation.hidden, true);
  assert.equal(motion.attributes.get("aria-describedby"), 'fixture-motion-description');
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
  const skyChanges = [], f = fixture({ onSkyContrastChange: value => skyChanges.push(value) }), shell = f.mount();
  const search = f.selectors.get('.planet-sidebar-search');
  const drawer = f.selectors.get('.planet-drawer-content');
  const motion = f.selectors.get('.planet-motion-setting');
  const contrast = f.selectors.get('.planet-sky-contrast-setting');
  const heliosphere = f.selectors.get('.planet-heliosphere-setting');
  motion.checked = true; motion.dispatchEvent(new Event('change'));
  contrast.checked = true; contrast.dispatchEvent(new Event('change'));
  heliosphere.checked = true; heliosphere.dispatchEvent(new Event('change'));
  const searchListeners = search.listeners.size, drawerListeners = drawer.listeners.size;
  for (const id of ['second', 'third', 'first']) {
    shell.setObject({ id, name: id, apply() {} });
    assert.equal(f.selectors.get('.planet-sidebar-search'), search);
    assert.equal(f.selectors.get('.planet-drawer-content'), drawer);
    assert.equal(search.value, "", "Object navigation does not write to search");
    assert.equal(search.listeners.size, searchListeners);
    assert.equal(drawer.listeners.size, drawerListeners);
    assert.equal(motion.checked, true);
    assert.equal(contrast.checked, true);
    assert.equal(heliosphere.checked, true);
    assert.equal(f.documentTarget.body.dataset.skyContrast, 'high');
  }
  assert.deepEqual(skyChanges, [true], 'Content replacement preserves contrast without replaying intent');
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

test('camera scale changes retained overview content without moving the camera and search selects the matching category tab', () => {
  const f = fixture(), browser = f.selectors.get('.planet-object-browser');
  const galaxy = new Element(), system = new Element(), introduction = new Element();
  system.selectors.set('.planet-introduction', introduction);
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-solar-system-results]', system);
  const items = ['planet', 'satellite'].map(type => {
    const item = new Element();
    item.dataset = { objectName: type === 'planet' ? 'earth' : 'moon', objectSystemName: 'solar system',
      objectClassification: type, objectClassificationName: type === 'planet' ? 'planet' : 'moon' };
    return item;
  });
  browser.selectors.set('.planet-object-item', items);
  const tabs = browser.querySelectorAll('[data-object-tab]');
  const shell = f.mount(), search = f.selectors.get('.planet-sidebar-search'), listeners = new Set();
  let world = { pose: { positionM: [0, 0, context.camera.maximumDistanceM] } };
  const before = structuredClone(world);
  shell.setOverview(true);
  shell.setCamera({ navigation: { capture: () => world,
    subscribe(callback) { listeners.add(callback); callback(world); return () => listeners.delete(callback); },
  } });
  assert.equal(search.value, '');
  assert.equal(galaxy.hidden, false); assert.equal(system.hidden, true);
  assert.deepEqual(world, before, 'Only the sidebar context changes');
  world = { pose: { positionM: [0, 0, context.volume.fadeStartDistanceM * .9] } };
  for (const callback of listeners) callback(world);
  assert.equal(search.value, ''); assert.equal(system.hidden, false); assert.equal(galaxy.hidden, true);
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  assert.equal(introduction.hidden, false, 'Search keeps the Solar System introduction visible');
  assert.equal(items[0].hidden, true); assert.equal(items[1].hidden, false);
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
  search.value = 'Solar System'; search.dispatchEvent(new Event('input'));
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true', 'The current category survives clearing the filter');
  tabs[2].dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Home' }));
  assert.equal(f.documentTarget.activeElement, tabs[0]);
  assert.equal(items[0].hidden, false); assert.equal(items[1].hidden, false);
  assert.equal(tabs[0].querySelector('.planet-object-tab-count').textContent, '(2)');
  tabs[2].dispatchEvent(new Event('click'));
  assert.equal(items[1].hidden, false);
  assert.equal(browser.querySelector('#object-category-results').getAttribute('aria-labelledby'), tabs[2].id);
  shell.destroy(); assert.equal(listeners.size, 0);
});

test('clearing search keeps the current object or overview card and permits another search', () => {
  const f = fixture(), browser = f.selectors.get('.planet-object-browser');
  const information = f.selectors.get('.planet-information-panel');
  const galaxy = new Element(), system = new Element(), item = new Element();
  item.dataset = { objectName: 'moon', objectSystemName: 'solar system',
    objectClassification: 'satellite', objectClassificationName: 'moon' };
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-solar-system-results]', system);
  browser.selectors.set('.planet-object-item', [item]);
  const shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  shell.setObject({ id: 'earth', name: 'Earth', apply() {} });
  const input = value => { search.value = value; search.dispatchEvent(new Event('input')); };
  const checkClear = (scope, value = '') => {
    input('moon');
    assert.equal(browser.hidden, false);
    assert.equal(information.hidden, true);
    input(value);
    assert.equal(search.value, value, 'The cleared input is not refilled');
    assert.equal(information.hidden, scope !== 'object');
    assert.equal(browser.hidden, scope === 'object');
    assert.equal(f.selectors.get('.planet-object-empty').hidden, true);
    if (scope !== 'object') {
      assert.equal(galaxy.hidden, scope !== 'milky-way');
      assert.equal(system.hidden, scope === 'milky-way');
      if (scope === 'solar-system') assert.equal(item.hidden, false);
    }
  };
  checkClear('object');
  checkClear('object', '   ');
  shell.setOverview(true);
  checkClear('solar-system');
  const world = { pose: { positionM: [0, 0, context.camera.maximumDistanceM] } };
  const before = structuredClone(world);
  shell.setCamera({ navigation: { capture: () => world,
    subscribe(callback) { callback(world); return () => {}; },
  } });
  checkClear('milky-way');
  assert.deepEqual(world, before, 'Clearing search never moves the camera');
  shell.setOverview(false);
  checkClear('object');
  shell.destroy();
});

test('flight completion and overview handoff preserve a newer active search', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  shell.setObject({ id: 'first', name: 'First', apply() {} });
  f.documentTarget.activeElement = search;
  search.value = 'second'; search.dispatchEvent(new Event('input'));
  shell.setObject({ id: 'first', name: 'First', apply() {} });
  assert.equal(search.value, 'second');
  assert.equal(f.selectors.get('.planet-information-panel').hidden, true);
  shell.setOverview(true);
  assert.equal(search.value, 'second');
  f.documentTarget.activeElement = null;
  shell.setOverview(false);
  assert.equal(search.value, 'second', 'Moving focus to results does not surrender the query');
  f.selectors.get('.planet-sidebar-view-all').dispatchEvent(new Event('click'));
  assert.equal(search.value, 'second', 'Search button preserves the active query');
  assert.equal(f.documentTarget.activeElement, search);
  assert.equal(f.selectors.get('.planet-information-panel').hidden, true);
  f.selectors.get('.planet-sidebar-view-all').dispatchEvent(new Event('click'));
  assert.equal(search.value, 'second', 'Repeating search does not dismiss results');
  search.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, 'second', 'Dismissing results preserves the user query');
  shell.destroy();
});


test('category pills reuse search, retain the query through navigation, and dismiss with Escape', () => {
  const f = fixture();
  const categories = [
    { label: 'Planets', type: 'planet', name: 'earth', singular: 'planet' },
    { label: 'Moons', type: 'satellite', name: 'moon', singular: 'moon' },
    { label: 'Asteroids', type: 'asteroid', name: 'eros', singular: 'asteroid' },
  ];
  const buttons = categories.map(category => {
    const button = new Element();
    button.dataset = { searchQuery: category.label, searchClassification: category.type };
    return button;
  });
  const items = categories.map(category => {
    const item = new Element();
    item.dataset = { objectName: category.name, objectSystemName: 'solar system',
      objectClassification: category.type, objectClassificationName: category.singular };
    return item;
  });
  const dwarf = new Element();
  dwarf.dataset = { objectName: 'pluto', objectSystemName: 'solar system',
    objectClassification: 'dwarf-planet', objectClassificationName: 'dwarf planet' };
  items.push(dwarf);
  f.selectors.set('.planet-search-category', buttons);
  const browser = f.selectors.get('.planet-object-browser');
  browser.selectors.set('.planet-object-item', items);
  const system = new Element(), introduction = new Element();
  system.selectors.set('.planet-introduction', introduction);
  browser.selectors.set('[data-solar-system-results]', system);
  const search = f.selectors.get('.planet-sidebar-search');
  const shell = f.mount();
  shell.setObject({ id: 'earth', name: 'Earth', apply() {} });
  buttons.forEach((button, index) => {
    button.dispatchEvent(new Event('click'));
    assert.equal(search.value, categories[index].label);
    assert.equal(introduction.hidden, false, 'Category results keep the introduction visible');
    assert.equal(browser.hidden, false);
    assert.equal(f.selectors.get('.planet-information-panel').hidden, true);
    assert.deepEqual(items.map(item => item.hidden), items.map((item, i) =>
      i !== index && !(index === 0 && item === dwarf)));
    assert.deepEqual(buttons.map(item => item.ariaPressed), buttons.map((_, i) => String(i === index)));
  });
  for (const query of ['planet', 'planets']) {
    search.value = query; search.dispatchEvent(new Event('input'));
    assert.deepEqual(items.map(item => item.hidden), [false, true, true, false]);
    assert.equal(buttons[0].ariaPressed, 'true');
  }
  search.value = 'dwarf planets'; search.dispatchEvent(new Event('input'));
  assert.deepEqual(items.map(item => item.hidden), [true, true, true, false], 'Specific dwarf planet search stays specific');
  buttons[2].dispatchEvent(new Event('click'));
  shell.setObject({ id: 'mars', name: 'Mars', apply() {} });
  assert.equal(search.value, 'Asteroids');
  assert.equal(buttons[2].ariaPressed, 'true');
  buttons[2].dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, 'Asteroids', 'Card changes never replace the query');
  assert.equal(f.documentTarget.activeElement, search);
  assert.equal(browser.hidden, true);
  assert.ok(buttons.every(button => button.ariaPressed === 'false'));
  shell.destroy();
  assert.ok(buttons.every(button => button.listeners.size === 0));
});

test('the overview preview changes immediately and survives a same-scene commit', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  shell.setObject({ id: 'sun', name: 'Sun', apply() {} });
  const cancel = shell.beginOverviewSelection();
  assert.equal(search.value, '');
  cancel();
  assert.equal(search.value, '');
  const restore = shell.beginOverviewSelection();
  shell.setOverview(true);
  restore();
  assert.equal(search.value, '');
  assert.equal(f.selectors.get('.planet-information-panel').hidden, true);
  shell.destroy();
});


test('an empty search survives dismissal, overview resets, and object commits', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  shell.setObject({ id: 'sun', name: 'Sun', apply() {} });
  shell.setOverview(true);
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  search.value = ''; search.dispatchEvent(new Event('input'));
  search.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, '', 'Escape does not insert the overview name');
  const restore = shell.beginOverviewSelection();
  assert.equal(search.value, '', 'Empty-scene selection leaves search empty');
  shell.setOverview(true); restore();
  assert.equal(search.value, '');
  assert.equal(f.selectors.get('.planet-object-browser').hidden, false, 'The overview card remains visible');
  shell.setObject({ id: 'jupiter', name: 'Jupiter', apply() {} });
  assert.equal(search.value, '', 'An object commit cannot auto-search Jupiter');
  assert.equal(f.selectors.get('.planet-information-panel').hidden, false);
  search.value = 'mars'; search.dispatchEvent(new Event('input'));
  const cancel = shell.beginOverviewSelection();
  search.value = 'venus'; search.dispatchEvent(new Event('input'));
  cancel();
  assert.equal(search.value, 'venus', 'Cancelling a card preview cannot overwrite a newer query');
  shell.destroy();
});
