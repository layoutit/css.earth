import assert from "node:assert/strict";
import test from "node:test";
import { mountPlanetShell } from "../planet-shell-client.mjs";
import context from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import catalogue from '../../src/objects/local-group/prepared/catalogue.json' with { type: 'json' };
import clusters from '../../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };

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
  const row = new Element(), explanation = new Element();
  explanation.id = "fixture-motion-blocked";
  row.selectors.set(".planet-motion-blocked", explanation);
  selectors.get(".planet-motion-setting").closest = () => row;
  const documentTarget = new Element();
  documentTarget.selectors = selectors;
  documentTarget.body = new Element();
  documentTarget.documentElement = new Element();
  selectors.get('.planet-sidebar-search').focus = () => {
    documentTarget.activeElement = selectors.get('.planet-sidebar-search');
  };
  const windowTarget = new Element();
  windowTarget.Event = Event;
  for (const name of ["HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLDetailsElement", "HTMLLIElement"])
    windowTarget[name] = Element;
  const frames = new Map(), timers = new Map();
  windowTarget.performance = { now: () => 0 };
  windowTarget.setTimeout = callback => { const id = ++nextFrame; timers.set(id, callback); return id; };
  windowTarget.clearTimeout = id => timers.delete(id);
  let nextFrame = 0;
  windowTarget.requestAnimationFrame = (callback) => { const id = ++nextFrame; frames.set(id, callback); return id; };
  windowTarget.cancelAnimationFrame = (id) => frames.delete(id);
  windowTarget.localStorage = { getItem() { return null; } };
  const changes = [];
  return { documentTarget, windowTarget, selectors, elements, frames, timers, row, explanation, changes,
    mount: () => mountPlanetShell({ objectId: "fixture", documentTarget, windowTarget, onMotionChange: (value) => changes.push(value), ...options }) };
}

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
  const f = fixture(), shell = f.mount();
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
    assert.equal(search.value, id);
    assert.equal(search.listeners.size, searchListeners);
    assert.equal(drawer.listeners.size, drawerListeners);
    assert.equal(motion.checked, true);
    assert.equal(contrast.checked, true);
    assert.equal(heliosphere.checked, true);
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
  const galaxy = new Element(), system = new Element(), introduction = new Element();
  system.selectors.set('.planet-introduction', introduction);
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
  assert.equal(introduction.hidden, false, 'Search keeps the Solar System introduction visible');
  assert.equal(groups[0].hidden, true); assert.equal(groups[1].hidden, false); assert.equal(groups[1].open, true);
  search.value = 'Solar System'; search.dispatchEvent(new Event('input'));
  assert.equal(groups[0].open, true); assert.equal(groups[1].open, false, 'Search preserves the previous collapsed state');
  shell.destroy(); assert.equal(listeners.size, 0);
});

test('a prepared galaxy takes precedence over the retained Milky Way card and clears cleanly on planet return', () => {
  const f = fixture(), browser = f.selectors.get('.planet-object-browser'), drawer = f.selectors.get('.planet-drawer-content');
  const galaxy = new Element(), system = new Element(), card = new Element();
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-solar-system-results]', system);
  browser.selectors.set('[data-prepared-focus-card]', card); drawer.selectors.set('[data-prepared-focus-card]', card);
  const names = ['name','aliases','status','distance','uncertainty','membership','association','basis','reference'];
  for (const name of names) card.selectors.set(`[data-focus-${name}]`, new Element());
  const links = [new Element(), new Element(), new Element()];
  card.selectors.set('[data-focus-source]', links);
  const readout = new Element();
  for (const selector of ['.planet-view-date', '[data-view-date]', '.planet-view-coordinates', '[data-view-latitude]', '[data-view-longitude]',
    '[data-view-altitude]', '[data-view-distance-label]', '.planet-view-altitude', '.planet-view-scale', '[data-view-scale-label]', '.planet-view-ruler', '.planet-view-measure']) {
    readout.selectors.set(selector, new Element());
  }
  f.selectors.set('.planet-view-readout', readout);
  const bounds = { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
  f.selectors.set('.polycss-scene', { closest: () => ({ getBoundingClientRect: () => bounds }) });
  const renderReadout = () => { const frames = [...f.frames.values()]; f.frames.clear(); frames.forEach(callback => callback()); };
  const retained = [...card.selectors.values()], source = catalogue.sources.find(value => value.id === 'lvdb-v1.1.1');
  const record = catalogue.objects.find(value => value.detailedObjectId === 'm31');
  const searchAction = f.selectors.get('.planet-sidebar-view-all');
  searchAction.textContent = 'Search'; searchAction.ariaLabel = 'Search objects';
  const listeners = new Set();
  const shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  shell.setOverview(true);
  shell.setCamera({ navigation: { capture: () => ({ epochJdTt: catalogue.frame.epochJdTt,
    pose: { positionM: record.positionM.map((value, axis) => value + (axis === 2 ? 1e18 : 0)), orientationXyzw: [0,0,0,1] } }),
    frame: { originM: [0,0,0], bodyRadiusM: 100 }, optics: () => ({ focalPixels: 1000, principalOffsetPixels: [0,0] }),
    subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); } } });
  assert.equal(search.value, 'Milky Way');
  shell.setPreparedFocus(record, [source]);
  renderReadout();
  assert.equal(search.value, record.name);
  assert.equal(card.hidden, false); assert.equal(galaxy.hidden, true); assert.equal(system.hidden, true);
  assert.equal(card.querySelector('[data-focus-name]').textContent, record.name);
  assert.match(card.querySelector('[data-focus-aliases]').textContent, /Andromeda/u);
  assert.match(card.querySelector('[data-focus-status]').textContent, /Confirmed galaxy/u);
  assert.equal(card.querySelector('[data-focus-basis]').textContent, record.membership.basis);
  assert.equal(links[0].href, source.url);
  assert.equal(readout.querySelector('[data-view-distance-label]').textContent, `Distance to ${record.name}:`);
  assert.equal(readout.querySelector('[data-view-altitude]').textContent, '105.7 ly');
  assert.equal(readout.querySelector('.planet-view-coordinates').hidden, true);
  const candidate = catalogue.objects.find(value => value.status === 'candidate');
  for (const notify of listeners) notify();
  assert.equal(f.frames.size, 0, 'Camera changes retain the 100 ms readout throttle');
  assert.equal(f.timers.size, 1);
  shell.setPreparedFocus(candidate);
  assert.equal(f.timers.size, 0, 'A focus change immediately refreshes the throttled readout');
  assert.equal(f.frames.size, 1);
  assert.equal(card.querySelector('[data-focus-status]').textContent, 'Candidate galaxy');
  assert.equal(links[0].hidden, true);
  const cluster = clusters.objects[0];
  shell.setPreparedFocus(cluster, [clusters.sources[0]]);
  assert.equal(card.hidden, false); assert.equal(search.value, cluster.name);
  assert.equal(card.querySelector('[data-focus-status]').textContent, 'X-ray selected galaxy cluster');
  assert.match(card.querySelector('[data-focus-distance]').textContent, /comoving, redshift-derived/u);
  assert.match(card.querySelector('[data-focus-basis]').textContent, /R500.*not the cluster boundary.*peculiar velocities are not corrected/u);
  assert.equal(links[0].href, clusters.sources[0].url);
  assert.deepEqual([...card.selectors.values()], retained, 'Selection updates the same retained card nodes');
  assert.equal(searchAction.textContent, 'Search', 'Focus updates preserve the explorer search action');
  assert.equal(searchAction.ariaLabel, 'Search objects');
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  shell.setPreparedFocus(candidate);
  assert.equal(search.value, 'moon', 'A focus handoff preserves a newer active search');
  assert.equal(card.hidden, true);
  search.value = '   '; search.dispatchEvent(new Event('input'));
  assert.equal(search.value, '   ', 'Clearing search restores the current focus without refilling the input');
  assert.equal(card.hidden, false); assert.equal(galaxy.hidden, true); assert.equal(system.hidden, true);
  shell.setPreparedFocus(cluster, [clusters.sources[0]]);
  assert.equal(search.value, '   ');
  assert.equal(card.querySelector('[data-focus-name]').textContent, cluster.name);
  search.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, cluster.name);
  shell.setPreparedFocus(null);
  renderReadout();
  assert.equal(readout.querySelector('[data-view-distance-label]').textContent, 'Distance from Sun:');
  assert.equal(card.hidden, true); assert.equal(search.value, 'Milky Way');
  shell.setObject({ id: 'next', name: 'Next planet', apply() {} });
  assert.equal(search.value, 'Next planet');
  assert.equal(f.selectors.get('.planet-information-panel').hidden, false);
  shell.destroy();
  assert.equal(f.timers.size, 0);
  assert.equal(listeners.size, 0);
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
  assert.equal(search.value, 'First');
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
  assert.equal(search.value, 'Mars');
  assert.equal(f.documentTarget.activeElement, search);
  assert.equal(browser.hidden, true);
  assert.ok(buttons.every(button => button.ariaPressed === 'false'));
  shell.destroy();
  assert.ok(buttons.every(button => button.listeners.size === 0));
});

test('sidebar collapse survives object navigation, reveals search results, and cleans its listeners', () => {
  const f = fixture(), shell = f.mount();
  const sidebar = f.selectors.get('.planet-sidebar');
  const toggle = f.selectors.get('.planet-sidebar-collapse');
  const search = f.selectors.get('.planet-sidebar-search');
  sidebar.scrollTop = 120;
  toggle.dispatchEvent(new Event('click'));
  assert.equal(sidebar.inert, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(f.documentTarget.body.dataset.sidebarCollapsed, 'true');
  shell.setObject({ id: 'next', name: 'Next', apply() { sidebar.id = 'next-sidebar'; } });
  assert.equal(sidebar.inert, true);
  assert.equal(toggle.getAttribute('aria-controls'), 'next-sidebar');
  toggle.dispatchEvent(new Event('click'));
  assert.equal(sidebar.inert, false);
  assert.equal(sidebar.scrollTop, 120);
  for (const trigger of ['input', 'click']) {
    toggle.dispatchEvent(new Event('click'));
    const target = trigger === 'input' ? search : f.selectors.get('.planet-sidebar-view-all');
    target.dispatchEvent(new Event(trigger));
    assert.equal(sidebar.inert, false);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  }
  shell.destroy();
  toggle.dispatchEvent(new Event('click'));
  assert.equal(f.documentTarget.body.dataset.sidebarCollapsed, undefined);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});
