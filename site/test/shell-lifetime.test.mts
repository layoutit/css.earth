import assert from "node:assert/strict";
import test from "node:test";
import { mountPlanetShell, type ShellOptions } from "../planet-shell-client.mts";
import context from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import catalogueInput from '../../src/objects/local-group/prepared/catalogue.json' with { type: 'json' };
import clustersInput from '../../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };

import type { BrowserWindow } from '../browser-types.mts';
import { required, position, objectFixture, navigationFixture, unusedSharedView } from './navigation-test-values.mts';
import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog } from '@cssearth/catalog';
import type { WorldCameraPose, PreparedWorldCameraFrame } from '../../src/renderers/css/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '../../src/renderers/css/runtime/world-navigation-types.ts';
import type { ShellCamera } from '../browser-types.mts';
const catalogue = parsePreparedGalaxyCatalog(catalogueInput), clusters = parsePreparedClusterCatalog(clustersInput);
const cameraFrame = (bodyRadiusM = 1000): PreparedWorldCameraFrame => ({ referenceFrame: 'world', epochJdTt: 1,
  originM: [0,0,0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM });
const worldAt = (range: number): WorldCameraPose => ({ referenceFrame: 'world', epochJdTt: 1,
  pose: { positionM: [0,0,range], orientationXyzw: [0,0,0,1] } });
type CameraNotifications = Set<(world?: WorldCameraPose) => void>;
function shellCamera(capture: () => WorldCameraPose, listeners: CameraNotifications, { frame = cameraFrame(), immediate = false } = {}): ShellCamera {
  const optics: ReturnType<ObjectWorldNavigation['optics']> = { focalPixels: 1000, principalOffsetPixels: [0,0],
    detailHandoffDiameterPixels: 14, framingRadiusPixels: 1, visibleRect: null };
  return { sharedView: unusedSharedView, navigation: { ...navigationFixture(frame, capture, () => optics),
    subscribe(callback) { const notify = (world = capture()) => callback(world, optics);
      listeners.add(notify); if (immediate) notify(); return () => { listeners.delete(notify); }; },
  } };
}
class SelectorMap extends Map<string, Element | Element[]> {
  element(selector: string): Element {
    const value = this.get(selector);
    assert.ok(value instanceof Element, `Missing fixture element: ${selector}`);
    return value;
  }
}
class Element extends EventTarget {
  dataset: Record<string, string | undefined> = {}; children: Element[] = []; value = '';
  style = { containIntrinsicBlockSize: '', removeProperty(_name?: string) { return ''; }, setProperty(_name?: string, _value?: string) {} };
  classList = { remove(..._names: string[]) {}, toggle(_name: string, _force?: boolean) {}, contains(_name: string) { return false; } };
  checked = false; hidden = false; open = false; id = ''; inert = false; disabled = false;
  textContent = ''; href = ''; ariaPressed: string | null = null; ariaLabel: string | null = null; scrollTop = 0;
  attributes = new Map<string, string>(); listeners = new Set<EventListenerOrEventListenerObject | null>();
  selectors = new SelectorMap();
  ownerDocument?: FixtureDocument;
  getBoundingClientRect?: () => Pick<DOMRect, 'x' | 'y' | 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
  closest: (selector: string) => Element | null = () => null;
  focus: () => void = () => {};
  querySelector(selector: string): Element | null { const value = this.selectors.get(selector); return Array.isArray(value) ? value[0] ?? null : value ?? null; }
  querySelectorAll(selector: string): Element[] { const value = this.selectors.get(selector); return Array.isArray(value) ? value : value ? [value] : []; }
  requireSelector(selector: string): Element { return required(this.querySelector(selector)); }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  hasAttribute(key: string) { return this.attributes.has(key); }
  removeAttribute(key: string) { this.attributes.delete(key); }
  append(...items: Element[]) { this.children = items; }
  override addEventListener(...[type, listener, options]: Parameters<EventTarget['addEventListener']>) {
    super.addEventListener(type, listener, options);
    this.listeners.add(listener);
    if (typeof options === 'object') options?.signal?.addEventListener('abort', () => this.listeners.delete(listener), { once: true });
  }
}
class FixtureDocument extends Element {
  defaultView: FixtureWindow | null = null;
  body = new Element(); documentElement = new Element(); activeElement: Element | null = null;
}
interface VisibilityObserver { observed: globalThis.Element[]; disconnected: boolean; options?: IntersectionObserverInit; observe(node: globalThis.Element): void; disconnect(): void; }
class FixtureWindow extends Element {
  location = new URL('http://localhost/earth/');
  Event = Event;
  CustomEvent = CustomEvent;
  HTMLElement = Element; HTMLButtonElement = Element; HTMLInputElement = Element; HTMLSelectElement = Element; HTMLDetailsElement = Element; HTMLLIElement = Element;
  performance = { now: () => 0 };
  localStorage = { getItem: (_key?: string): string | null => null };
  setTimeout: (callback: () => void, delay?: number) => number = () => { throw new Error('Timer fixture is not installed.'); };
  clearTimeout: (id: number) => void = () => {};
  requestAnimationFrame: (callback: FrameRequestCallback) => number = () => { throw new Error('Frame fixture is not installed.'); };
  cancelAnimationFrame: (id: number) => void = () => {};
  // The fixture is a wide layout, so phone-only sheet gestures stay idle.
  matchMedia = (_query: string) => Object.assign(new EventTarget(), { matches: false });
  IntersectionObserver?: new (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => VisibilityObserver;
  ResizeObserver = class { constructor(_callback: ResizeObserverCallback) {} observe() {} unobserve() {} disconnect() {} };
  MutationObserver: new (callback: MutationCallback) => { observe(target: Node): void; disconnect(): void } =
    class { constructor(_callback: MutationCallback) {} observe() {} disconnect() {} };
}
function fixture(options: Partial<ShellOptions> = {}) {
  const selectors = new SelectorMap();
  const elements: Element[] = [];
  for (const selector of [".planet-drawer-content", ".planet-sidebar", ".planet-sidebar-collapse",
    ".planet-sidebar-search", ".planet-sidebar-search-card", ".planet-sidebar-view-all",
    ".planet-information-panel", ".planet-object-browser", ".planet-object-empty",
    ".planet-sheet-handle", ".planet-settings-panel", ".planet-settings-action",
    ".explorer-rail-explore", ".explorer-rail-about", ".explorer-about-panel",
    ".planet-motion-setting", ".planet-surface-labels-setting", ".planet-heliosphere-setting", ".planet-illustration-models-setting", ".planet-minimap-setting", ".planet-three-d-stars-setting"]) {
    const element = new Element();
    selectors.set(selector, element); elements.push(element);
  }
  const drawer = selectors.element(".planet-drawer-content");
  drawer.selectors.set(".planet-sheet-handle", selectors.element(".planet-sheet-handle"));
  drawer.selectors.set(".planet-information-panel", selectors.element(".planet-information-panel"));
  const item = new Element();
  selectors.element(".planet-object-browser").selectors.set(".planet-object-item", [item]);
  const tabs = ['all', 'planet', 'satellite', 'asteroid'].map(type => {
    const tab = new Element(); tab.dataset.objectTab = type; tab.id = `object-tab-${type}`;
    tab.selectors.set('.planet-object-tab-count', new Element()); elements.push(tab);
    return tab;
  });
  selectors.element('.planet-object-browser').selectors.set('[data-object-tab]', tabs);
  selectors.element('.planet-object-browser').selectors.set('#object-category-results', new Element());
  const row = new Element(), explanation = new Element();
  explanation.id = "fixture-motion-blocked";
  row.selectors.set(".planet-motion-blocked", explanation);
  selectors.element(".planet-motion-setting").closest = () => row;
  const documentTarget = new FixtureDocument();
  documentTarget.selectors = selectors;
  documentTarget.body = new Element();
  documentTarget.documentElement = new Element();
  for (const tab of tabs) tab.focus = () => { documentTarget.activeElement = tab; };
  selectors.element('.planet-sidebar-search').focus = () => {
    documentTarget.activeElement = selectors.element('.planet-sidebar-search');
  };
  const windowTarget = new FixtureWindow();
  documentTarget.defaultView = windowTarget;
  windowTarget.Event = Event;
  for (const name of ["HTMLElement", "HTMLButtonElement", "HTMLInputElement", "HTMLSelectElement", "HTMLDetailsElement", "HTMLLIElement"] as const)
    windowTarget[name] = Element;
  const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, () => void>();
  windowTarget.performance = { now: () => 0 };
  windowTarget.setTimeout = callback => { const id = ++nextFrame; timers.set(id, callback); return id; };
  windowTarget.clearTimeout = id => timers.delete(id);
  let nextFrame = 0;
  windowTarget.requestAnimationFrame = (callback) => { const id = ++nextFrame; frames.set(id, callback); return id; };
  windowTarget.cancelAnimationFrame = (id) => frames.delete(id);
  windowTarget.localStorage = { getItem() { return null; } };
  const changes: boolean[] = [];
  return { documentTarget, windowTarget, selectors, elements, frames, timers, row, explanation, changes,
    mount: () => mountPlanetShell({ objectId: "fixture", documentTarget: documentTarget as unknown as Document, windowTarget: windowTarget as unknown as BrowserWindow, onMotionChange: (value) => changes.push(value), ...options }) };
}

test('retained catalogue groups follow filters and release their visibility observer', () => {
  const f = fixture(), browser = f.selectors.element('.planet-object-browser');
  const items = Array.from({ length: 17 }, (_, index) => index === 16 ? 'mars' : `earth-${index}`).map(objectName => {
    const item = new Element(); item.dataset = { objectName, objectSystemName: 'solar system', objectClassification: 'planet' };
    return item;
  });
  const groups = [items.slice(0, 16), items.slice(16)].map(rows => {
    const group = new Element(); group.selectors.set('.planet-object-item', rows);
    group.selectors.set('.planet-object-chunk-list', new Element()); return group;
  });
  browser.selectors.set('.planet-object-item', items);
  browser.selectors.set('.planet-object-chunk', groups);
  let observer: VisibilityObserver | undefined;
  const getObserver = () => required(observer);
  f.windowTarget.IntersectionObserver = class {
    observed: globalThis.Element[] = []; disconnected = false;
    options: IntersectionObserverInit | undefined;
    constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { observer = this; this.options = options; }
    observe(node: globalThis.Element) { this.observed.push(node); }
    disconnect() { this.disconnected = true; }
  };
  const shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  assert.equal(browser.inert, true);
  assert.deepEqual(getObserver().observed, groups);
  assert.equal(getObserver().options?.root, browser.querySelector('#object-category-results'));
  search.value = 'mars'; search.dispatchEvent(new Event('input'));
  assert.deepEqual(groups.map(group => group.hidden), [true, false]);
  assert.deepEqual(groups.map(group => group.style.containIntrinsicBlockSize), ['0px', '20px']);
  assert.equal(browser.inert, false);
  assert.equal(f.selectors.element('.planet-information-panel').inert, true);
  search.value = 'Solar System'; search.dispatchEvent(new Event('input'));
  assert.deepEqual(groups.map(group => group.hidden), [false, false]);
  search.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
  assert.equal(browser.inert, true);
  assert.equal(f.selectors.element('.planet-information-panel').inert, false);
  shell.destroy();
  assert.equal(getObserver().disconnected, true);
});

// Asteroid dots default off: the busiest layer must not cost a first view.
test('Illustration models starts off and retains its independent preference across body navigation', () => {
  const changes: boolean[] = [], f = fixture({ onIllustrationModelsChange: value => changes.push(value) }), shell = f.mount();
  const toggle = f.selectors.element('.planet-illustration-models-setting');
  assert.equal(toggle.checked, false);
  assert.equal(f.documentTarget.body.dataset.illustrationModels, 'off');
  for (const enabled of [true, false]) {
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change'));
    for (const id of ['itokawa', 'sun', 'saturn']) {
      shell.setObject({ id, name: id, apply() {}, dispose() {} });
      assert.equal(toggle.checked, enabled);
      assert.equal(f.documentTarget.body.dataset.illustrationModels, enabled ? 'on' : 'off');
      assert.equal(f.selectors.element('.planet-heliosphere-setting').checked, false);
    }
  }
  assert.deepEqual(changes, [true, false]);
  shell.destroy();
  toggle.dispatchEvent(new Event('change'));
  assert.deepEqual(changes, [true, false]);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test('Surface labels starts off and retains its independent preference across body navigation', () => {
  const changes: boolean[] = [], f = fixture({ onSurfaceLabelsChange: value => changes.push(value) }), shell = f.mount();
  const toggle = f.selectors.element('.planet-surface-labels-setting');
  assert.equal(toggle.checked, false);
  assert.equal(f.documentTarget.body.dataset.surfaceLabels, 'off');
  for (const enabled of [true, false]) {
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change'));
    for (const id of ['itokawa', 'sun', 'saturn']) {
      shell.setObject({ id, name: id, apply() {}, dispose() {} });
      assert.equal(toggle.checked, enabled);
      assert.equal(f.documentTarget.body.dataset.surfaceLabels, enabled ? 'on' : 'off');
      assert.equal(f.selectors.element('.planet-heliosphere-setting').checked, false);
    }
  }
  assert.deepEqual(changes, [true, false]);
  shell.destroy();
  toggle.dispatchEvent(new Event('change'));
  assert.deepEqual(changes, [true, false]);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test('Minimap starts off, mirrors its state for the stylesheet and keeps the preference across body navigation', () => {
  const changes: boolean[] = [], f = fixture({ onMinimapChange: value => changes.push(value) }), shell = f.mount();
  const toggle = f.selectors.element('.planet-minimap-setting');
  assert.equal(toggle.checked, false); assert.equal(toggle.disabled, false);
  assert.equal(f.documentTarget.body.dataset.minimap, 'off');
  for (const enabled of [true, false]) {
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change'));
    for (const id of ['itokawa', 'sun', 'saturn']) {
      shell.setObject({ id, name: id, apply() {}, dispose() {} });
      assert.equal(toggle.checked, enabled);
      assert.equal(f.documentTarget.body.dataset.minimap, enabled ? 'on' : 'off');
      assert.equal(f.selectors.element('.planet-surface-labels-setting').checked, false);
    }
  }
  assert.deepEqual(changes, [true, false]);
  shell.destroy();
  assert.equal(toggle.disabled, true);
  toggle.dispatchEvent(new Event('change'));
  assert.deepEqual(changes, [true, false]);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test('3D stars starts off and retains its independent preference across body navigation', () => {
  const changes: boolean[] = [], f = fixture({ onThreeDStarsChange: value => changes.push(value) }), shell = f.mount();
  const toggle = f.selectors.element('.planet-three-d-stars-setting');
  assert.equal(toggle.checked, false); assert.equal(toggle.disabled, false);
  for (const enabled of [true, false]) {
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change'));
    for (const id of ['itokawa', 'sun', 'saturn']) {
      shell.setObject({ id, name: id, apply() {}, dispose() {} });
      assert.equal(toggle.checked, enabled);
      assert.equal(f.selectors.element('.planet-minimap-setting').checked, false);
    }
  }
  assert.deepEqual(changes, [true, false]);
  shell.destroy();
  assert.equal(toggle.disabled, true);
  toggle.dispatchEvent(new Event('change'));
  assert.deepEqual(changes, [true, false]);
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test("shell with no optional controls keeps Motion and accessible blocked intent", () => {
  const f = fixture(), shell = f.mount();
  const motion = f.selectors.element(".planet-motion-setting");
  motion.setAttribute('aria-describedby', 'fixture-motion-description');
  assert.equal(f.selectors.element('.planet-heliosphere-setting').checked, false, 'Heliosphere starts off');
  shell.setPlaybackState({ motionRequested: true, allowed: false, reason: "reduced-motion" });
  assert.equal(motion.checked, true);
  assert.equal(f.explanation.hidden, false);
  assert.equal(motion.attributes.get("aria-describedby"), `fixture-motion-description ${f.explanation.id}`);
  assert.deepEqual(f.changes, [], "Rendering policy must not dispatch another intent event");
  shell.setPlaybackState({ motionRequested: true, allowed: true, reason: "allowed" });
  assert.equal(f.explanation.hidden, true);
  assert.equal(motion.attributes.get("aria-describedby"), 'fixture-motion-description');
  motion.checked = false; motion.dispatchEvent(new Event("change"));
  assert.deepEqual(f.changes, [false]);
  shell.destroy(); shell.destroy();
  shell.setMotionEnabled(true);
  shell.setPlaybackState({ motionRequested: true, allowed: true, reason: "allowed" });
  assert.equal(motion.checked, false);
  assert.deepEqual(f.changes, [false]);
  assert.equal(f.frames.size, 0);
  assert.ok(f.elements.every((element) => element.listeners.size === 0));
  motion.checked = true; motion.dispatchEvent(new Event("change"));
  assert.deepEqual(f.changes, [false]);
});

test("failed shell construction cleans earlier controllers and their scheduled work", () => {
  const f = fixture();
  f.selectors.delete(".planet-surface-labels-setting");
  assert.throws(f.mount, /settings controls are incomplete/);
  assert.equal(f.frames.size, 0);
  assert.ok(f.elements.every((element) => element.listeners.size === 0));
  assert.equal(f.windowTarget.listeners.size, 0);
  assert.equal(f.documentTarget.listeners.size, 0);
});

test('object content replacement retains shell controls and input state without accumulating listeners', () => {
  const labelChanges: boolean[] = [], f = fixture({ onSurfaceLabelsChange: value => labelChanges.push(value) }), shell = f.mount();
  const search = f.selectors.element('.planet-sidebar-search');
  const drawer = f.selectors.element('.planet-drawer-content');
  const motion = f.selectors.element('.planet-motion-setting');
  const surfaceLabels = f.selectors.element('.planet-surface-labels-setting');
  const heliosphere = f.selectors.element('.planet-heliosphere-setting');
  motion.checked = true; motion.dispatchEvent(new Event('change'));
  surfaceLabels.checked = true; surfaceLabels.dispatchEvent(new Event('change'));
  heliosphere.checked = true; heliosphere.dispatchEvent(new Event('change'));
  const searchListeners = search.listeners.size, drawerListeners = drawer.listeners.size;
  for (const id of ['second', 'third', 'first']) {
    shell.setObject({ id, name: id, apply() {}, dispose() {} });
    assert.equal(f.selectors.element('.planet-sidebar-search'), search);
    assert.equal(f.selectors.element('.planet-drawer-content'), drawer);
    assert.equal(search.value, "", "Object navigation does not write to search");
    assert.equal(search.listeners.size, searchListeners);
    assert.equal(drawer.listeners.size, drawerListeners);
    assert.equal(motion.checked, true);
    assert.equal(surfaceLabels.checked, true);
    assert.equal(heliosphere.checked, true);
    assert.equal(f.documentTarget.body.dataset.surfaceLabels, 'on');
  }
  assert.deepEqual(labelChanges, [true], 'Content replacement preserves surface labels without replaying intent');
  assert.deepEqual(f.changes, [true]);
  shell.destroy();
  assert.ok(f.elements.every(element => element.listeners.size === 0));
});

test("Motion cannot enable Speed before the shared runtime is ready or after it retires", () => {
  const f = fixture(), speed = new Element();
  speed.dataset.runtimeReady = "false";
  f.selectors.set('.planet-speed-setting[type="range"][name="speed"]', speed);
  const shell = f.mount();
  shell.setPlaybackState({ motionRequested: true, allowed: false, reason: "loading" });
  assert.equal(speed.disabled, true);
  speed.dataset.runtimeReady = "true";
  shell.setPlaybackState({ motionRequested: true, allowed: true, reason: "allowed" });
  assert.equal(speed.disabled, false);
  shell.setPlaybackState({ motionRequested: false, allowed: false, reason: "motion-off" });
  assert.equal(speed.disabled, true);
  speed.dataset.runtimeReady = "false";
  shell.setPlaybackState({ motionRequested: true, allowed: false, reason: "loading" });
  assert.equal(speed.disabled, true);
  shell.destroy();
});

test('camera zoom preserves native information selections and focus without installing tab listeners', () => {
  const f = fixture(), information = f.selectors.element('.planet-information-panel');
  const factsTab = new Element(), spectrumTab = new Element();
  factsTab.dataset.informationTab = 'factsheet';
  spectrumTab.dataset = { informationGroup: 'overview', informationTab: 'spectrum' };
  information.selectors.set('[data-information-tab]:not([hidden])', [factsTab, spectrumTab]);
  const shell = f.mount(), listeners: CameraNotifications = new Set();
  const children = information.children;
  let world = worldAt(10000);
  shell.setCamera(shellCamera(() => world, listeners));
  // These properties are set by the browser's radio interaction, covered in
  // progressive-enhancement-browser.mts with application scripts disabled.
  factsTab.checked = true; spectrumTab.checked = true;
  f.documentTarget.activeElement = spectrumTab;
  for (const [range, view] of [[1e8, 'overview'], [10000, 'detail']] as const) {
    world = worldAt(range);
    for (const callback of listeners) callback(world);
    assert.equal(information.dataset.cardView, view);
    assert.equal(information.children, children);
    assert.equal(factsTab.checked, true);
    assert.equal(spectrumTab.checked, true);
    assert.equal(f.documentTarget.activeElement, spectrumTab);
  }
  assert.equal(factsTab.listeners.size + spectrumTab.listeners.size, 0);
  shell.destroy();
  assert.equal(listeners.size, 0);
});

test('destination card stays fixed across flight poses and camera handoff, then follows manual zoom', () => {
  const f = fixture(), shell = f.mount(), information = f.selectors.element('.planet-information-panel');
  const frame = cameraFrame(), listeners: CameraNotifications = new Set();
  const at = worldAt;
  let world = at(10000);
  const camera = shellCamera(() => world, listeners, { frame });
  shell.setCamera(camera);
  const finish = shell.beginCardNavigation(objectFixture('fixture', frame), at(1e8));
  shell.beginObjectSelection(objectFixture('fixture', cameraFrame(), { name: 'Fixture' }));
  assert.equal(information.dataset.cardView, 'overview', 'The endpoint card appears immediately');
  for (const range of [1e8, 10000, 1e7, 10000]) {
    world = at(range); for (const notify of listeners) notify(world);
    assert.equal(information.dataset.cardView, 'overview');
  }
  shell.setCamera(null);
  shell.setObject({ id: 'fixture', name: 'Fixture', apply() {}, dispose() {} });
  assert.equal(information.dataset.cardView, 'overview', 'Card stays fixed while the destination mounts');
  world = at(1e8); shell.setCamera(camera); finish();
  assert.equal(information.dataset.cardView, 'overview');
  world = at(10000); for (const notify of listeners) notify(world);
  assert.equal(information.dataset.cardView, 'detail', 'Manual zoom works after the flight');
  const cancelled = shell.beginCardNavigation(objectFixture('fixture', frame), at(1e8));
  cancelled();
  assert.equal(information.dataset.cardView, 'detail', 'Cancellation follows the actual camera');
  shell.destroy();
});

test('camera scale keeps the overview, while search hides and dismissal restores its Atlas navigation', () => {
  const f = fixture(), browser = f.selectors.element('.planet-object-browser');
  const galaxy = new Element(), system = new Element(), introduction = new Element();
  system.selectors.set('.planet-introduction', introduction);
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-system-results]', system);
  const categoryTabs = new Element();
  const navigationTree = new Element();
  const solarSystemBranch = new Element(), planetBranch = new Element(), earthBranch = new Element();
  solarSystemBranch.open = false; planetBranch.open = true; earthBranch.open = true;
  navigationTree.selectors.set('details[data-atlas-depth]:not([data-atlas-depth="0"])', [planetBranch, earthBranch]);
  navigationTree.selectors.set('details[data-atlas-depth="0"][data-atlas-key="solar-system"]', solarSystemBranch);
  system.selectors.set('[data-object-navigation-tree]', navigationTree);
  browser.selectors.set('[data-system-results] > .planet-selected-panel', introduction);
  browser.selectors.set('[data-system-results] > .planet-object-tabs', categoryTabs);
  browser.selectors.set('[data-object-navigation-tree]', navigationTree);
  const items = ['planet', 'satellite'].map(type => {
    const item = new Element();
    item.dataset = { objectName: type === 'planet' ? 'earth' : 'moon', objectSystemName: 'solar system',
      objectClassification: type, objectClassificationName: type === 'planet' ? 'planet' : 'moon' };
    return item;
  });
  browser.selectors.set('.planet-object-item', items);
  const tabs = browser.querySelectorAll('[data-object-tab]');
  const shell = f.mount(), search = f.selectors.element('.planet-sidebar-search'), listeners: CameraNotifications = new Set();
  let world = worldAt(context.volume.fullDistanceM);
  const before = structuredClone(world);
  shell.setOverview(true);
  shell.setCamera(shellCamera(() => world, listeners, { immediate: true }));
  assert.equal(search.value, '');
  assert.equal(galaxy.hidden, false); assert.equal(system.hidden, true);
  assert.deepEqual(world, before, 'Only the sidebar context changes');
  planetBranch.open = true; earthBranch.open = true;
  world = worldAt(context.volume.fadeStartDistanceM * .9);
  for (const callback of listeners) callback(world);
  assert.equal(search.value, ''); assert.equal(system.hidden, false); assert.equal(galaxy.hidden, true);
  assert.equal(solarSystemBranch.open, true, 'Solar System stays expanded when its overview auto-selects');
  assert.equal(planetBranch.open, false, 'Second-level groups collapse when Solar System auto-selects');
  assert.equal(earthBranch.open, false, 'Deeper body branches collapse with their second-level group');
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  assert.equal(introduction.hidden, true, 'Search hides the card heading and introduction');
  assert.equal(categoryTabs.hidden, true);
  assert.equal(navigationTree.hidden, true);
  assert.equal(browser.requireSelector('#object-category-results').hidden, false);
  assert.equal(items[0].hidden, true); assert.equal(items[1].hidden, false);
  assert.equal(tabs[2].getAttribute('aria-selected'), 'true');
  search.value = 'Solar System'; search.dispatchEvent(new Event('input'));
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true', 'Text search includes every matching category');
  assert.equal(browser.requireSelector('#object-category-results').getAttribute('aria-labelledby'), null);
  search.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }));
  assert.equal(introduction.hidden, false);
  assert.equal(categoryTabs.hidden, true);
  assert.equal(navigationTree.hidden, false);
  assert.equal(browser.requireSelector('#object-category-results').hidden, true);
  assert.equal(items[0].hidden, false); assert.equal(items[1].hidden, false);
  assert.equal(tabs[0].requireSelector('.planet-object-tab-count').textContent, '(2)');
  tabs[2].dispatchEvent(new Event('click'));
  assert.equal(items[1].hidden, false);
  assert.equal(browser.requireSelector('#object-category-results').getAttribute('aria-labelledby'), tabs[2].id);
  shell.destroy(); assert.equal(listeners.size, 0);
});

test('the planet lens controller ignores an earlier retained galaxy bank and binds its own lens controls', () => {
  const f = fixture(), drawer = f.selectors.element('.planet-drawer-content');
  const focusedBank = new Element(), planetBank = new Element(), option = new Element(), button = new Element(), detail = new Element();
  const information = f.selectors.element('.planet-information-panel');
  // A broad drawer query returns the earlier, initially hidden galaxy dataset section.
  focusedBank.hidden = true;
  drawer.selectors.set('.planet-lenses', focusedBank);
  information.selectors.set('.planet-lenses', planetBank);
  button.value = 'planet-observation'; button.ariaPressed = 'true';
  detail.dataset.lensDetails = button.value; detail.hidden = true;
  option.selectors.set('button[name="dataset"]', button);
  planetBank.selectors.set('[data-lens-option]', [option]);
  information.selectors.set('[data-lens-details]', [detail]);
  const observed: Node[] = [];
  f.windowTarget.MutationObserver = class {
    observe(target: Node) { observed.push(target); }
    disconnect() {}
  };
  const shell = f.mount();
  const chrome = new Set<unknown>([f.documentTarget.body, f.documentTarget.documentElement]);
  assert.deepEqual(observed.filter(node => !chrome.has(node)), [button]);
  assert.equal(detail.hidden, false);
  assert.equal(focusedBank.hidden, true);
  shell.destroy();
  assert.equal(detail.hidden, true);
});

test('a prepared galaxy takes precedence over the retained Milky Way card and clears cleanly on planet return', () => {
  const f = fixture(), browser = f.selectors.element('.planet-object-browser'), drawer = f.selectors.element('.planet-drawer-content');
  const galaxy = new Element(), system = new Element(), card = new Element();
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-system-results]', system);
  browser.selectors.set('[data-prepared-focus-card]', card); drawer.selectors.set('[data-prepared-focus-card]', card);
  const names = ['name','aliases','introduction','status','distance','uncertainty','membership','association'];
  for (const name of names) card.selectors.set(`[data-focus-${name}]`, new Element());
  card.selectors.set('[data-focus-fact-label=distance]', new Element());
  const links = [new Element(), new Element(), new Element()];
  card.selectors.set('[data-focus-source]', links);
  const lensBank = new Element(), lensButton = new Element(), lensDetail = new Element();
  lensButton.value = 'prepared-dataset'; lensDetail.dataset.focusLensDetails = lensButton.value;
  lensBank.selectors.set('[data-focus-lens]', [lensButton]);
  lensBank.selectors.set('[data-focus-lens-details]', [lensDetail]);
  card.selectors.set('[data-focus-lens-bank], [data-focus-facts-bank]', [lensBank]);
  const readout = new Element();
  for (const selector of ['.planet-view-date', '[data-view-date]', '.planet-view-coordinates', '[data-view-latitude]', '[data-view-longitude]',
    '[data-view-altitude]', '[data-view-distance-label]', '.planet-view-altitude', '.planet-view-scale', '[data-view-scale-label]', '.planet-view-ruler', '.planet-view-measure']) {
    readout.selectors.set(selector, new Element());
  }
  f.selectors.set('.planet-view-readout', readout);
  const bounds = { x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
  f.selectors.set('.polycss-scene', Object.assign(new Element(), { ownerDocument: f.documentTarget }));
  f.selectors.set('.polycss-camera', Object.assign(new Element(), { getBoundingClientRect: () => bounds }));
  f.selectors.set('.planet-stage', Object.assign(new Element(), { getBoundingClientRect: () => bounds }));
  const renderReadout = () => { const frames = [...f.frames.values()]; f.frames.clear(); frames.forEach(callback => callback(0)); };
  const retained = [...card.selectors.values()], source = required(catalogue.sources.find(value => value.id === 'lvdb-v1.1.1'));
  const record = required(catalogue.objects.find(value => value.detailedObjectId === 'm31'));
  const searchAction = f.selectors.element('.planet-sidebar-view-all');
  searchAction.textContent = 'Search'; searchAction.ariaLabel = 'Search objects';
  const listeners: CameraNotifications = new Set();
  const shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  shell.setOverview(true);
  shell.setCamera(shellCamera(() => ({ referenceFrame: catalogue.frame.referenceFrame, epochJdTt: catalogue.frame.epochJdTt,
    pose: { positionM: position(record.positionM.map((value, axis) => value + (axis === 2 ? 1e18 : 0))), orientationXyzw: [0,0,0,1] } }),
    listeners, { frame: cameraFrame(100) }));
  assert.equal(search.value, '');
  lensBank.dataset.focusLensBank = record.detailedObjectId;
  const lensSelections: string[] = [];
  shell.setPreparedFocus(record, [source], { objectId: required(record.detailedObjectId), id: "fixture-bank", defaultLens: lensButton.value,
    selectedLens: lensButton.value, lenses: [{ id: lensButton.value, label: "Dataset", title: "Dataset", description: "Fixture dataset", sourceUrl: "https://example.test/dataset" }], starsVisible: true,
    selectLens: id => { lensSelections.push(id); } });
  assert.equal(lensBank.hidden, false); assert.equal(lensDetail.hidden, false);
  assert.equal(lensButton.getAttribute('aria-pressed'), 'true');
  lensButton.dispatchEvent(new Event('click'));
  assert.deepEqual(lensSelections, [lensButton.value]);
  renderReadout();
  assert.equal(search.value, '', 'Galaxy focus does not write to search');
  assert.equal(card.hidden, false); assert.equal(galaxy.hidden, true); assert.equal(system.hidden, true);
  assert.equal(card.requireSelector('[data-focus-name]').textContent, record.name);
  assert.match(card.requireSelector('[data-focus-aliases]').textContent, /Andromeda/u);
  assert.match(card.requireSelector('[data-focus-status]').textContent, /Confirmed galaxy/u);
  assert.equal(links[0].href, source.url);
  assert.equal(readout.requireSelector('[data-view-distance-label]').textContent, `Distance to ${record.name}:`);
  assert.equal(readout.requireSelector('[data-view-altitude]').textContent, '105.7 ly');
  assert.equal(readout.requireSelector('.planet-view-coordinates').hidden, true);
  const candidate = required(catalogue.objects.find(value => value.status === 'candidate'));
  for (const notify of listeners) notify();
  assert.equal(f.frames.size, 0, 'Camera changes retain the 100 ms readout throttle');
  assert.equal(f.timers.size, 1);
  shell.setPreparedFocus(candidate);
  assert.equal(f.timers.size, 0, 'A focus change immediately refreshes the throttled readout');
  assert.equal(f.frames.size, 1);
  assert.equal(card.requireSelector('[data-focus-status]').textContent, 'Candidate galaxy');
  assert.equal(links[0].hidden, true);
  const cluster = clusters.objects[0];
  shell.setPreparedFocus(cluster, [clusters.sources[0]]);
  assert.equal(card.hidden, false); assert.equal(search.value, '');
  assert.equal(card.requireSelector('[data-focus-status]').textContent, 'X-ray selected galaxy cluster');
  assert.equal(card.requireSelector('[data-focus-fact-label=distance]').textContent, 'Comoving distance');
  assert.match(card.requireSelector('[data-focus-distance]').textContent, /^\d+(?:\.\d+)? Mpc$/u);
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
  assert.equal(card.requireSelector('[data-focus-name]').textContent, cluster.name);
  search.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, '   ', 'Dismissing search retains the user query');
  const restoreOverview = shell.beginOverviewSelection('system', 'sun');
  assert.equal(card.hidden, true); assert.equal(system.hidden, false);
  restoreOverview();
  assert.equal(card.hidden, false); assert.equal(galaxy.hidden, true);
  assert.equal(f.documentTarget.documentElement.dataset.selection, 'prepared-focus');
  const restoreObject = shell.beginObjectSelection(objectFixture('fixture', cameraFrame(), { name: 'Fixture' }));
  assert.equal(browser.hidden, true);
  restoreObject();
  assert.equal(browser.hidden, false); assert.equal(card.hidden, false);
  assert.equal(search.value, '   ', 'Cancelled selection restores focus without changing search');
  shell.setPreparedFocus(null);
  renderReadout();
  assert.equal(readout.requireSelector('[data-view-distance-label]').textContent, 'Distance from Sun:');
  assert.equal(card.hidden, true); assert.equal(search.value, '   ');
  shell.setObject({ id: 'next', name: 'Next planet', apply() {}, dispose() {} });
  assert.equal(search.value, '   ');
  assert.equal(f.selectors.element('.planet-information-panel').hidden, false);
  shell.destroy();
  assert.equal(lensButton.listeners.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(listeners.size, 0);
});
test('clearing search keeps the current object or overview card and permits another search', () => {
  const f = fixture(), browser = f.selectors.element('.planet-object-browser');
  const information = f.selectors.element('.planet-information-panel');
  const galaxy = new Element(), system = new Element(), item = new Element();
  item.dataset = { objectName: 'moon', objectSystemName: 'solar system',
    objectClassification: 'satellite', objectClassificationName: 'moon' };
  browser.selectors.set('[data-galactic-overview]', galaxy);
  browser.selectors.set('[data-system-results]', system);
  browser.selectors.set('.planet-object-item', [item]);
  const shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  shell.setObject({ id: 'earth', name: 'Earth', apply() {}, dispose() {} });
  const input = (value: string) => { search.value = value; search.dispatchEvent(new Event('input')); };
  const checkClear = (scope: string, value = '') => {
    input('moon');
    assert.equal(browser.hidden, false);
    assert.equal(information.hidden, true);
    input(value);
    assert.equal(search.value, value, 'The cleared input is not refilled');
    assert.equal(information.hidden, scope !== 'object');
    assert.equal(browser.hidden, scope === 'object');
    assert.equal(f.selectors.element('.planet-object-empty').hidden, true);
    if (scope !== 'object') {
      assert.equal(galaxy.hidden, scope !== 'milky-way');
      assert.equal(system.hidden, scope === 'milky-way');
      if (scope === 'system') assert.equal(item.hidden, false);
    }
  };
  checkClear('object');
  checkClear('object', '   ');
  shell.setOverview(true);
  checkClear('system');
  const world = worldAt(context.volume.fullDistanceM);
  const before = structuredClone(world);
  shell.setCamera(shellCamera(() => world, new Set(), { immediate: true }));
  checkClear('milky-way');
  assert.deepEqual(world, before, 'Clearing search never moves the camera');
  shell.setOverview(false);
  checkClear('object');
  shell.destroy();
});

test('flight completion and overview handoff preserve a newer active search', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  shell.setObject({ id: 'first', name: 'First', apply() {}, dispose() {} });
  f.documentTarget.activeElement = search;
  search.value = 'second'; search.dispatchEvent(new Event('input'));
  shell.setObject({ id: 'first', name: 'First', apply() {}, dispose() {} });
  assert.equal(search.value, 'second');
  assert.equal(f.selectors.element('.planet-information-panel').hidden, true);
  shell.setOverview(true);
  assert.equal(search.value, 'second');
  f.documentTarget.activeElement = null;
  shell.setOverview(false);
  assert.equal(search.value, 'second', 'Moving focus to results does not surrender the query');
  f.selectors.element('.planet-sidebar-view-all').dispatchEvent(new Event('click'));
  assert.equal(search.value, 'second', 'Search button preserves the active query');
  assert.equal(f.documentTarget.activeElement, search);
  assert.equal(f.selectors.element('.planet-information-panel').hidden, true);
  f.selectors.element('.planet-sidebar-view-all').dispatchEvent(new Event('click'));
  assert.equal(search.value, 'second', 'Repeating search does not dismiss results');
  search.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, 'second', 'Dismissing results preserves the user query');
  shell.destroy();
});


test('category pills toggle shared results without camera navigation or opening the search sheet', async () => {
  const highlights: (string | null)[] = [];
  const f = fixture({ onCategoryChange: value => highlights.push(value) });
  const categories = [
    { label: 'Planets', type: 'planet', name: 'earth', singular: 'planet' },
    { label: 'Moons', type: 'satellite', name: 'moon', singular: 'moon' },
    { label: 'Comets', type: 'comet', name: 'halley', singular: 'comet' },
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
  const browser = f.selectors.element('.planet-object-browser');
  browser.selectors.set('.planet-object-item', items);
  const system = new Element(), introduction = new Element();
  system.selectors.set('.planet-introduction', introduction);
  browser.selectors.set('[data-system-results]', system);
  browser.selectors.set('[data-system-results] > .planet-selected-panel', introduction);
  const search = f.selectors.element('.planet-sidebar-search');
  const shell = f.mount();
  shell.setObject({ id: 'earth', name: 'Earth', apply() {}, dispose() {} });
  // Observe the router request without adding a listener the shell's leak check would count.
  const navigations: unknown[] = [];
  for (const button of buttons) {
    const dispatch = button.dispatchEvent.bind(button);
    button.dispatchEvent = (event: Event) => {
      if (event.type === 'categorynavigate' && event instanceof CustomEvent) navigations.push((event.detail as { classification?: unknown }).classification);
      return dispatch(event);
    };
  }
  for (const [index, button] of buttons.entries()) {
    button.dispatchEvent(new Event('click'));
    await Promise.resolve();
    assert.equal(highlights.at(-1), categories[index].type);
    assert.equal(search.value, categories[index].label);
    assert.equal(introduction.hidden, true, 'Category searches also use the plain results card');
    assert.equal(browser.hidden, false);
    assert.equal(f.selectors.element('.planet-information-panel').hidden, true);
    assert.deepEqual(items.map(item => item.hidden), items.map((item, i) =>
      i !== index && !(index === 0 && item === dwarf)));
    assert.deepEqual(buttons.map(item => item.ariaPressed), buttons.map((_, i) => String(i === index)));
  }
  assert.deepEqual(navigations, [], 'pills never request camera navigation');
  buttons[3].dispatchEvent(new Event('click'));
  await Promise.resolve();
  assert.equal(search.value, '');
  assert.equal(browser.hidden, true);
  assert.equal(highlights.at(-1), null);
  assert.ok(buttons.every(button => button.ariaPressed === 'false'));
  assert.equal(f.selectors.element('.planet-sheet-handle').checked, false);
  for (const query of ['planet', 'planets']) {
    search.value = query; search.dispatchEvent(new Event('input'));
    assert.deepEqual(items.map(item => item.hidden), [false, true, true, true, false]);
    assert.equal(buttons[0].ariaPressed, 'true');
  }
  search.value = 'dwarf planets'; search.dispatchEvent(new Event('input'));
  assert.deepEqual(items.map(item => item.hidden), [true, true, true, true, false], 'Specific dwarf planet search stays specific');
  buttons[3].dispatchEvent(new Event('click'));
  shell.setObject({ id: 'mars', name: 'Mars', apply() {}, dispose() {} });
  assert.equal(search.value, 'Asteroids');
  assert.equal(buttons[3].ariaPressed, 'true');
  buttons[3].dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, 'Asteroids', 'Card changes never replace the query');
  assert.equal(f.documentTarget.activeElement, search);
  assert.equal(browser.hidden, true);
  assert.ok(buttons.every(button => button.ariaPressed === 'false'));
  shell.destroy();
  assert.ok(buttons.every(button => button.listeners.size === 0));
});

test('changing Illustration models refreshes an open category without erasing its query', () => {
  const f = fixture(), browser = f.selectors.element('.planet-object-browser');
  const earth = new Element(), haumea = new Element();
  earth.dataset = { objectName: 'earth', objectClassification: 'planet', objectClassificationName: 'planet' };
  haumea.dataset = { objectName: 'haumea', objectClassification: 'dwarf-planet', objectClassificationName: 'dwarf planet', objectIllustration: 'true' };
  browser.selectors.set('.planet-object-item', [earth, haumea]);
  const shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  search.value = 'Planets'; search.dispatchEvent(new Event('input'));
  assert.deepEqual([earth.hidden, haumea.hidden], [false, true]);
  const setting = f.selectors.element('.planet-illustration-models-setting');
  setting.checked = true; setting.dispatchEvent(new Event('change'));
  assert.deepEqual([earth.hidden, haumea.hidden], [false, false]);
  setting.checked = false; setting.dispatchEvent(new Event('change'));
  assert.deepEqual([earth.hidden, haumea.hidden], [false, true]);
  assert.equal(search.value, 'Planets');
  search.value = 'haumea'; search.dispatchEvent(new Event('input'));
  assert.equal(haumea.hidden, false, 'explicit names remain searchable');
  shell.destroy();
});

test('the overview preview changes immediately and survives a same-scene commit', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  shell.setObject({ id: 'sun', name: 'Sun', apply() {}, dispose() {} });
  const cancel = shell.beginOverviewSelection('system', 'sun');
  assert.equal(search.value, '');
  cancel();
  assert.equal(search.value, '');
  const restore = shell.beginOverviewSelection('system', 'sun');
  shell.setOverview(true);
  restore();
  assert.equal(search.value, '');
  assert.equal(f.selectors.element('.planet-information-panel').hidden, true);
  shell.destroy();
});


test('an empty search survives dismissal, overview resets, and object commits', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  shell.setObject({ id: 'sun', name: 'Sun', apply() {}, dispose() {} });
  shell.setOverview(true);
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  search.value = ''; search.dispatchEvent(new Event('input'));
  search.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }));
  assert.equal(search.value, '', 'Escape does not insert the overview name');
  const restore = shell.beginOverviewSelection('system', 'sun');
  assert.equal(search.value, '', 'Empty-scene selection leaves search empty');
  shell.setOverview(true); restore();
  assert.equal(search.value, '');
  assert.equal(f.selectors.element('.planet-object-browser').hidden, false, 'The overview card remains visible');
  shell.setObject({ id: 'jupiter', name: 'Jupiter', apply() {}, dispose() {} });
  assert.equal(search.value, '', 'An object commit cannot auto-search Jupiter');
  assert.equal(f.selectors.element('.planet-information-panel').hidden, false);
  search.value = 'mars'; search.dispatchEvent(new Event('input'));
  const cancel = shell.beginOverviewSelection('system', 'sun');
  search.value = 'venus'; search.dispatchEvent(new Event('input'));
  cancel();
  assert.equal(search.value, 'venus', 'Cancelling a card preview cannot overwrite a newer query');
  shell.destroy();
});


test('choosing the current body from search shows its card without editing the query', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  shell.setObject({ id: 'sun', name: 'Sun', apply() {}, dispose() {} });
  search.value = 'Sun'; search.dispatchEvent(new Event('input'));
  assert.equal(f.selectors.element('.planet-information-panel').hidden, true);
  const cancel = shell.beginObjectSelection(objectFixture('sun', cameraFrame(), { name: 'Sun' }));
  assert.equal(f.selectors.element('.planet-information-panel').hidden, false);
  assert.equal(search.value, 'Sun');
  shell.setOverview(false); cancel();
  assert.equal(f.selectors.element('.planet-information-panel').hidden, false, 'Commit cannot reopen the search results');
  assert.equal(search.value, 'Sun');
  shell.destroy();
});

test('a Milky Way breadcrumb previews its own card and preserves the search query', () => {
  const f = fixture(), shell = f.mount(), search = f.selectors.element('.planet-sidebar-search');
  search.value = 'moon'; search.dispatchEvent(new Event('input'));
  const cancel = shell.beginOverviewSelection('milky-way', 'sun');
  assert.equal(f.documentTarget.documentElement.dataset.selection, 'milky-way');
  assert.equal(search.value, 'moon');
  cancel();
  assert.equal(search.value, 'moon');
  shell.destroy();
});

test('camera handoffs retain filtered results and reset only a scrolled results panel', () => {
  const f = fixture(), browser = f.selectors.element('.planet-object-browser');
  const results = browser.requireSelector('#object-category-results');
  let scrollTop = 0, scrollWrites = 0, countWrites = 0;
  Object.defineProperty(results, 'scrollTop', { get: () => scrollTop, set(value: number) { scrollTop = value; scrollWrites++; } });
  for (const tab of browser.querySelectorAll('[data-object-tab]')) {
    Object.defineProperty(tab.requireSelector('.planet-object-tab-count'), 'textContent', { get: () => '', set() { countWrites++; } });
  }
  const shell = f.mount(), listeners: CameraNotifications = new Set();
  shell.setOverview(true);
  const publishedCounts = countWrites;
  shell.setCamera(shellCamera(() => worldAt(context.volume.fadeStartDistanceM * .9), listeners));
  shell.setOverview(true);
  assert.equal(countWrites, publishedCounts, 'The same catalogue query is not republished at camera handoff');
  assert.equal(scrollWrites, 0, 'An unscrolled catalogue never triggers a synchronous scroll reset');
  scrollTop = 120;
  results.dispatchEvent(new Event('scroll'));
  shell.setOverview(false);
  assert.equal(scrollTop, 0, 'Closing a scrolled catalogue restores its next opening position');
  assert.equal(scrollWrites, 1);
  shell.setOverview(true);
  assert.equal(browser.hidden, false, 'Cached results reopen without another filter');
  assert.equal(countWrites, publishedCounts);
  shell.destroy();
});
