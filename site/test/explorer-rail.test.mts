import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createExplorerRailController } from "../explorer-rail.mts";
import { MOBILE_VIEWPORT_QUERY } from "../runtime-policy.mts";

function fixture({ mobile = false } = {}) {
  const documentTarget: EventTarget & { activeElement: Element | null; body: { dataset: Record<string, string | undefined> }; querySelector(selector: string): Element | null } =
    Object.assign(new EventTarget(), { activeElement: null, body: { dataset: {} }, querySelector: (_selector: string): Element | null => null });
  class Element extends EventTarget {
    hidden = false;
    ariaPressed: string | null = null;
    ariaLabel: string | null = null;
    scrollTop = 0;
    scrolledIntoView = 0;
    scrollIntoView() { this.scrolledIntoView += 1; }
    focus() { documentTarget.activeElement = this; }
    click() { this.dispatchEvent(new Event("click")); }
    matches() { return false; }
  }
  class Button extends Element {}
  class Input extends Element {}
  const nodes = {
    about: { selector: '.explorer-rail-about', node: new Button() },
    explore: { selector: '.explorer-rail-explore', node: new Button() },
    panel: { selector: '.explorer-about-panel', node: new Element() },
    drawer: { selector: '.object-drawer-content', node: new Element() },
    search: { selector: '.object-sidebar-search-card', node: new Element() },
    searchInput: { selector: '.object-sidebar-search', node: new Input() },
    settings: { selector: '.object-settings-action', node: new Button() },
    settingsPanel: { selector: '.object-settings-panel', node: new Element() },
    aside: { selector: '.object-sidebar', node: new Element() },
    facilityToggle: { selector: '.object-facility-toggle', node: new Button() },
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
    settings: nodes.settings.node, settingsPanel: nodes.settingsPanel.node, aside: nodes.aside.node,
    facilityToggle: nodes.facilityToggle.node };
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
  assert.equal(f.search.hidden, false);
  f.searchInput.dispatchEvent(new Event("input"));
  assert.equal(f.search.hidden, false);
  assert.equal(f.drawer.hidden, false);
  assert.equal(f.panel.hidden, true);
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
  second.destroy();
});

test("an incomplete rail fails clearly", () => {
  const f = fixture();
  f.documentTarget.querySelector = () => null;
  assert.throws(f.mount, /Explorer rail is incomplete/);
});
