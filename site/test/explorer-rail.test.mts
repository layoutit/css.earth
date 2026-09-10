import assert from "node:assert/strict";
import test from "node:test";
import { createExplorerRailController } from "../explorer-rail.mts";
import { MOBILE_VIEWPORT_QUERY } from "../runtime-policy.mts";

function fixture({ mobile = false } = {}) {
  const documentTarget = new EventTarget();
  class Element extends EventTarget {
    hidden = false;
    focus() { documentTarget.activeElement = this; }
    click() { this.dispatchEvent(new Event("click")); }
  }
  class Button extends Element {}
  class Input extends Element {}
  const nodes = Object.fromEntries([
    ["about", ".explorer-rail-about", new Button()],
    ["explore", ".explorer-rail-explore", new Button()],
    ["panel", ".explorer-about-panel", new Element()],
    ["drawer", ".planet-drawer-content", new Element()],
    ["search", ".planet-sidebar-search-card", new Element()],
    ["searchInput", ".planet-sidebar-search", new Input()],
    ["settings", ".planet-settings-action", new Button()],
    ["settingsPanel", ".planet-settings-panel", new Element()],
    ["aside", ".planet-sidebar", new Element()],
  ].map(([key, selector, node]) => [key, { selector, node }]));
  documentTarget.querySelector = (selector) =>
    Object.values(nodes).find((entry) => entry.selector === selector)?.node;
  const scrolls = [];
  const windowTarget = {
    HTMLElement: Element,
    HTMLButtonElement: Button,
    HTMLInputElement: Input,
    matchMedia(query) {
      assert.equal(query, MOBILE_VIEWPORT_QUERY);
      return { matches: mobile };
    },
    scrollTo(options) { scrolls.push(options); },
  };
  const solarSystemRequests = [];
  const mount = () => createExplorerRailController(documentTarget, windowTarget, {
    onOpenSolarSystem() { solarSystemRequests.push("solar-system"); },
  });
  const elements = Object.fromEntries(Object.entries(nodes).map(([key, { node }]) => [key, node]));
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
