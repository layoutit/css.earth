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
    assert.equal(search.value, "", "Object navigation does not write to search");
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

test('overview and detail tabs keep independent selections and keyboard focus across camera zoom', () => {
  const f = fixture(), information = f.selectors.get('.planet-information-panel');
  const datasetTab = new Element(), factsTab = new Element(), dataset = new Element(), facts = new Element();
  datasetTab.dataset.informationTab = 'dataset'; factsTab.dataset.informationTab = 'factsheet';
  dataset.dataset.informationPanel = 'dataset'; facts.dataset.informationPanel = 'factsheet';
  const overviewTabs = ['moons', 'factsheet', 'spectrum'].map(id => {
    const tab = new Element();
    tab.dataset = { informationGroup: 'overview', informationTab: id };
    tab.focus = () => { f.documentTarget.activeElement = tab; };
    return tab;
  });
  const overviewPanels = overviewTabs.map(tab => {
    const panel = new Element();
    panel.dataset = { informationGroup: 'overview', informationPanel: tab.dataset.informationTab };
    return panel;
  });
  information.selectors.set('[data-information-tab]:not([hidden])', [...overviewTabs, datasetTab, factsTab]);
  information.selectors.set('[data-information-panel]', [...overviewPanels, dataset, facts]);
  const shell = f.mount(), listeners = new Set(), search = f.selectors.get('.planet-sidebar-search');
  const children = information.children;
  let world = { pose: { positionM: [0, 0, 10000] } };
  shell.setCamera({ navigation: { frame: { originM: [0,0,0], bodyRadiusM: 1000 },
    optics: () => ({ focalPixels: 1000, detailHandoffDiameterPixels: 14 }), capture: () => world,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
  } });
  assert.equal(information.dataset.cardView, 'detail');
  factsTab.dispatchEvent(new Event('click'));
  overviewTabs[1].dispatchEvent(new Event('click'));
  assert.deepEqual(overviewPanels.map(panel => panel.hidden), [true, false, true]);
  const key = value => {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value });
    f.documentTarget.activeElement.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  };
  overviewTabs[1].focus();
  key('ArrowRight');
  assert.equal(f.documentTarget.activeElement, overviewTabs[2]);
  assert.deepEqual(overviewPanels.map(panel => panel.hidden), [true, true, false]);
  key('ArrowRight');
  assert.equal(f.documentTarget.activeElement, overviewTabs[0], 'Arrow keys wrap within the overview');
  key('End');
  assert.equal(f.documentTarget.activeElement, overviewTabs[2]);
  search.value = 'my search';
  for (const [range, view] of [[1e8, 'overview'], [10000, 'detail']]) {
    world = { pose: { positionM: [0,0,range] } };
    for (const callback of listeners) callback(world);
    assert.equal(information.dataset.cardView, view);
    assert.equal(information.children, children, 'Both views stay mounted');
    assert.equal(facts.hidden, false); assert.equal(dataset.hidden, true);
    assert.equal(factsTab.getAttribute('aria-selected'), 'true');
    assert.deepEqual(overviewPanels.map(panel => panel.hidden), [true, true, false]);
    assert.equal(overviewTabs[2].getAttribute('aria-selected'), 'true');
    assert.equal(search.value, 'my search');
  }
  shell.destroy();
  assert.equal(listeners.size, 0);
  assert.ok([...overviewTabs, datasetTab, factsTab].every(tab => tab.listeners.size === 0));
});

test('destination card stays fixed across flight poses and camera handoff, then follows manual zoom', () => {
  const f = fixture(), shell = f.mount(), information = f.selectors.get('.planet-information-panel');
  const frame = { originM: [0, 0, 0], bodyRadiusM: 1000 }, listeners = new Set();
  const at = range => ({ pose: { positionM: [0, 0, range] } });
  let world = at(10000);
  const camera = { navigation: { frame,
    optics: () => ({ focalPixels: 1000, detailHandoffDiameterPixels: 14 }), capture: () => world,
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
  } };
  shell.setCamera(camera);
  const finish = shell.beginCardNavigation({ id: 'fixture', worldFrame: frame }, at(1e8));
  shell.beginObjectSelection({ id: 'fixture', name: 'Fixture' });
  assert.equal(information.dataset.cardView, 'overview', 'The endpoint card appears immediately');
  for (const range of [1e8, 10000, 1e7, 10000]) {
    world = at(range); for (const notify of listeners) notify(world);
    assert.equal(information.dataset.cardView, 'overview');
  }
  shell.setCamera(null);
  shell.setObject({ id: 'fixture', name: 'Fixture', apply() {} });
  assert.equal(information.dataset.cardView, 'overview', 'Card stays fixed while the destination mounts');
  world = at(1e8); shell.setCamera(camera); finish();
  assert.equal(information.dataset.cardView, 'overview');
  world = at(10000); for (const notify of listeners) notify(world);
  assert.equal(information.dataset.cardView, 'detail', 'Manual zoom works after the flight');
  const cancelled = shell.beginCardNavigation({ id: 'fixture', worldFrame: frame }, at(1e8));
  cancelled();
  assert.equal(information.dataset.cardView, 'detail', 'Cancellation follows the actual camera');
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

test('the planet lens controller ignores an earlier retained galaxy bank and binds its own lens controls', () => {
  const f = fixture(), drawer = f.selectors.get('.planet-drawer-content');
  const focusedBank = new Element(), planetBank = new Element(), option = new Element(), button = new Element(), detail = new Element();
  const information = f.selectors.get('.planet-information-panel');
  // A broad drawer query returns the earlier, initially hidden galaxy dataset section.
  focusedBank.hidden = true;
  drawer.selectors.set('.planet-lenses', focusedBank);
  information.selectors.set('.planet-lenses', planetBank);
  button.value = 'planet-observation'; button.ariaPressed = 'true';
  detail.dataset.lensDetails = button.value; detail.hidden = true;
  option.selectors.set('button[name="lens"]', button);
  planetBank.selectors.set('[data-lens-option]', [option]);
  information.selectors.set('[data-lens-details]', [detail]);
  const observed = [];
  f.windowTarget.MutationObserver = class {
    observe(target) { observed.push(target); }
    disconnect() {}
  };
  const shell = f.mount();
  assert.deepEqual(observed, [button]);
  assert.equal(detail.hidden, false);
  assert.equal(focusedBank.hidden, true);
  shell.destroy();
  assert.equal(detail.hidden, true);
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
  const lensBank = new Element(), lensButton = new Element(), lensDetail = new Element();
  lensButton.value = 'prepared-dataset'; lensDetail.dataset.focusLensDetails = lensButton.value;
  lensBank.selectors.set('[data-focus-lens]', [lensButton]);
  lensBank.selectors.set('[data-focus-lens-details]', [lensDetail]);
  card.selectors.set('[data-focus-lens-bank]', [lensBank]);
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
  assert.equal(search.value, '');
  lensBank.dataset.focusLensBank = record.detailedObjectId;
  const lensSelections = [];
  shell.setPreparedFocus(record, [source], { objectId: record.detailedObjectId,
    selectedLens: lensButton.value, lenses: [{ id: lensButton.value }], starsVisible: true,
    selectLens: id => lensSelections.push(id) });
  assert.equal(lensBank.hidden, false); assert.equal(lensDetail.hidden, false);
  assert.equal(lensButton.getAttribute('aria-pressed'), 'true');
  lensButton.dispatchEvent(new Event('click'));
  assert.deepEqual(lensSelections, [lensButton.value]);
  renderReadout();
  assert.equal(search.value, '', 'Galaxy focus does not write to search');
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
  assert.equal(card.hidden, false); assert.equal(search.value, '');
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
  assert.equal(search.value, '   ', 'Dismissing search retains the user query');
  const restoreOverview = shell.beginOverviewSelection('solar-system');
  assert.equal(card.hidden, true); assert.equal(system.hidden, false);
  restoreOverview();
  assert.equal(card.hidden, false); assert.equal(galaxy.hidden, true);
  assert.equal(f.documentTarget.documentElement.dataset.selection, 'prepared-focus');
  const restoreObject = shell.beginObjectSelection({ id: 'fixture', name: 'Fixture' });
  assert.equal(browser.hidden, true);
  restoreObject();
  assert.equal(browser.hidden, false); assert.equal(card.hidden, false);
  assert.equal(search.value, '   ', 'Cancelled selection restores focus without changing search');
  shell.setPreparedFocus(null);
  renderReadout();
  assert.equal(readout.querySelector('[data-view-distance-label]').textContent, 'Distance from Sun:');
  assert.equal(card.hidden, true); assert.equal(search.value, '   ');
  shell.setObject({ id: 'next', name: 'Next planet', apply() {} });
  assert.equal(search.value, '   ');
  assert.equal(f.selectors.get('.planet-information-panel').hidden, false);
  shell.destroy();
  assert.equal(lensButton.listeners.size, 0);
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


test('choosing the current body from search shows its card without editing the query', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  shell.setObject({ id: 'sun', name: 'Sun', apply() {} });
  search.value = 'Sun'; search.dispatchEvent(new Event('input'));
  assert.equal(f.selectors.get('.planet-information-panel').hidden, true);
  const cancel = shell.beginObjectSelection({ id: 'sun', name: 'Sun' });
  assert.equal(f.selectors.get('.planet-information-panel').hidden, false);
  assert.equal(search.value, 'Sun');
  shell.setOverview(false); cancel();
  assert.equal(f.selectors.get('.planet-information-panel').hidden, false, 'Commit cannot reopen the search results');
  assert.equal(search.value, 'Sun');
  shell.destroy();
});

test('a Milky Way breadcrumb previews its own card and preserves the search query', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.get('.planet-sidebar-search');
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  const cancel = shell.beginOverviewSelection('milky-way');
  assert.equal(f.documentTarget.documentElement.dataset.selection, 'milky-way');
  assert.equal(search.value, 'moon');
  cancel();
  assert.equal(search.value, 'moon');
  shell.destroy();
});
