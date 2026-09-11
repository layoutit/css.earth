import assert from "node:assert/strict";
import test from "node:test";
import { createExplorerRailController } from "../explorer-rail.mts";
import { MOBILE_VIEWPORT_QUERY } from "../runtime-policy.mts";

function fixture({ mobile = false } = {}) {
  const documentTarget: EventTarget & { activeElement: Element | null; querySelector(selector: string): Element | null } =
    Object.assign(new EventTarget(), { activeElement: null, querySelector: (_selector: string): Element | null => null });
  class Element extends EventTarget {
    hidden = false;
    ariaPressed: string | null = null;
    ariaLabel: string | null = null;
    scrollTop = 0;
    focus() { documentTarget.activeElement = this; }
    click() { this.dispatchEvent(new Event("click")); }
  }
  class Button extends Element {}
  class Input extends Element {}
  const nodes = {
    about: { selector: '.explorer-rail-about', node: new Button() },
    explore: { selector: '.explorer-rail-explore', node: new Button() },
    panel: { selector: '.explorer-about-panel', node: new Element() },
    drawer: { selector: '.planet-drawer-content', node: new Element() },
    search: { selector: '.planet-sidebar-search-card', node: new Element() },
    searchInput: { selector: '.planet-sidebar-search', node: new Input() },
    settings: { selector: '.planet-settings-action', node: new Button() },
    settingsPanel: { selector: '.planet-settings-panel', node: new Element() },
    aside: { selector: '.planet-sidebar', node: new Element() },
  };
  documentTarget.querySelector = (selector: string) =>
    Object.values(nodes).find((entry) => entry.selector === selector)?.node ?? null;
  const scrolls: ScrollToOptions[] = [];
  const windowTarget = {
    HTMLElement: Element,
    HTMLButtonElement: Button,
    HTMLInputElement: Input,
    matchMedia(query: string) {
      assert.equal(query, MOBILE_VIEWPORT_QUERY);
      return { matches: mobile };
    },
    scrollTo(options: ScrollToOptions) { scrolls.push(options); },
  };
  const solarSystemRequests: string[] = [];
  // The controller uses only the retained elements, focus, event and viewport seams represented here.
  const mount = () => createExplorerRailController(documentTarget as unknown as Document, windowTarget as unknown as import("../browser-types.mts").BrowserWindow, {
    onOpenSolarSystem() { solarSystemRequests.push("solar-system"); },
  });
  const elements = { about: nodes.about.node, explore: nodes.explore.node, panel: nodes.panel.node,
    drawer: nodes.drawer.node, search: nodes.search.node, searchInput: nodes.searchInput.node,
    settings: nodes.settings.node, settingsPanel: nodes.settingsPanel.node, aside: nodes.aside.node };
  const escape = () => {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperty(event, "key", { value: "Escape" });
    documentTarget.dispatchEvent(event);
    return event;
  };
  return { ...elements, documentTarget, windowTarget, mount, scrolls, escape, solarSystemRequests };
}

test("rail switches the retained About panel without storing or mounting a scene", () => {
  const f = fixture();
  const controller = f.mount();
  assert.equal(f.panel.hidden, true);
  assert.equal(f.explore.ariaPressed, "true");
  assert.equal(f.about.ariaPressed, "false");
  assert.equal(f.settings.ariaPressed, "false");
  f.about.click();
  assert.equal(f.panel.hidden, false);
  assert.equal(f.drawer.hidden, true);
  assert.equal(f.search.hidden, false);
  assert.equal(f.about.ariaPressed, "true");
  assert.equal(f.aside.ariaLabel, "About cssEarth");
  assert.deepEqual(f.scrolls, []);
  f.explore.click();
  assert.deepEqual(f.solarSystemRequests, ["solar-system"]);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.drawer.hidden, false);
  assert.equal(f.search.hidden, false);
  assert.notEqual(f.documentTarget.activeElement, f.searchInput, "Opening the list must not focus search");
  assert.equal(f.about.ariaPressed, "false");
  controller.destroy();
});

test("Escape restores a visible keyboard focus target", () => {
  const f = fixture();
  const controller = f.mount();
  assert.equal(f.escape().defaultPrevented, false);
  f.about.click();
  assert.equal(f.escape().defaultPrevented, true);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.documentTarget.activeElement, f.about);
  controller.destroy();
});

test("settings shares the panel slot and mobile navigation returns to the top", () => {
  const f = fixture({ mobile: true });
  const controller = f.mount();
  f.about.click();
  f.settings.click();
  assert.equal(f.drawer.hidden, true);
  assert.equal(f.search.hidden, false);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.settingsPanel.hidden, false);
  assert.equal(f.settings.ariaPressed, "true");
  assert.equal(f.about.ariaPressed, "false");
  assert.equal(f.explore.ariaPressed, "false");
  assert.equal(f.aside.ariaLabel, "Settings");
  assert.deepEqual(f.scrolls, [
    { top: 0, behavior: "instant" },
    { top: 0, behavior: "instant" },
  ]);
  controller.destroy();
});

test("settings stays selected on repeat clicks and closes through About, Solar System, or Escape", () => {
  const f = fixture();
  const controller = f.mount();
  f.aside.scrollTop = 200;
  f.settings.click();
  f.settings.click();
  assert.equal(f.settingsPanel.hidden, false);
  assert.equal(f.aside.scrollTop, 0);
  f.about.click();
  assert.equal(f.settingsPanel.hidden, true);
  assert.equal(f.settings.ariaPressed, "false");
  assert.equal(f.panel.hidden, false);
  f.settings.click();
  assert.equal(f.escape().defaultPrevented, true);
  assert.equal(f.settingsPanel.hidden, true);
  assert.equal(f.drawer.hidden, false);
  assert.equal(f.documentTarget.activeElement, f.settings);
  f.settings.click();
  f.explore.click();
  assert.equal(f.settingsPanel.hidden, true);
  assert.equal(f.explore.ariaPressed, "true");
  controller.destroy();
});

test("search stays visible in About and Settings and typing returns to the results", () => {
  const f = fixture();
  const controller = f.mount();
  assert.equal(f.search.hidden, false);
  f.about.click();
  assert.equal(f.search.hidden, false);
  assert.equal(f.panel.hidden, false);
  f.searchInput.focus();
  assert.equal(f.panel.hidden, false, "focusing search keeps About open until an action");
  f.searchInput.dispatchEvent(new Event("input"));
  assert.equal(f.panel.hidden, true);
  assert.equal(f.drawer.hidden, false);
  f.settings.click();
  assert.equal(f.search.hidden, false);
  assert.equal(f.settingsPanel.hidden, false);
  f.searchInput.dispatchEvent(new Event("input"));
  assert.equal(f.search.hidden, false);
  assert.equal(f.drawer.hidden, false);
  assert.equal(f.panel.hidden, true);
  assert.equal(f.settingsPanel.hidden, true);
  controller.destroy();
});

test("destroy resets retained markup and remount does not duplicate listeners", () => {
  const f = fixture();
  const first = f.mount();
  f.about.click();
  first.destroy();
  first.destroy();
  assert.equal(f.drawer.hidden, false);
  assert.equal(f.search.hidden, false);
  assert.equal(f.panel.hidden, true);
  f.about.click();
  assert.equal(f.panel.hidden, true);
  const second = f.mount();
  f.settings.click();
  assert.equal(f.settingsPanel.hidden, false);
  second.destroy();
  assert.equal(f.settingsPanel.hidden, true);
  assert.equal(f.settings.ariaPressed, "false");
  f.settings.click();
  assert.equal(f.settingsPanel.hidden, true);
});

test("an incomplete rail fails clearly", () => {
  const f = fixture();
  f.documentTarget.querySelector = () => null;
  assert.throws(f.mount, /Explorer rail is incomplete/);
});
