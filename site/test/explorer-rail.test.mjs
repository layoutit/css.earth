import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createExplorerRailController } from "../explorer-rail.mjs";
import { MOBILE_VIEWPORT_QUERY } from "../runtime-policy.mjs";

test("Planet information starts the horizontal rail and Solar System is deprecated", async () => {
  const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
  const [rail, navigation, styles, client, railStyles, mapsStyles, shell, materialSymbol, materialSources, shellStyles, buildConfig] = await Promise.all([
    read("../components/ExplorerRail.astro"),
    read("../components/PlanetaryScale.astro"),
    read("../planetary-scale.css"),
    read("../planet-shell-client.mjs"),
    read("../explorer-rail.css"),
    read("../maps-shell.css"),
    read("../components/PlanetShell.astro"),
    read("../components/MaterialSymbol.astro"),
    read("../source/icons/material-symbols-outlined.mjs"),
    read("../shell-layout.css"),
    read("../../astro.config.mjs"),
  ]);
  assert.doesNotMatch(
    rail + shell,
    /PlanetaryScale|explorer-milky-way-panel|explorer-rail-milky-way|aria-label="Solar System"|>Solar System</u,
  );
  assert.match(rail, /explorer-rail-explore[\s\S]*?explorer-rail-about[\s\S]*?planet-settings-action/u);
  assert.doesNotMatch(rail, /SearchIcon|aria-label="Search"/u);
  assert.match(shell, /import SearchIcon from "\.\/SearchIcon\.astro";[\s\S]*?planet-sidebar-search-icon[\s\S]*?<SearchIcon \/>[\s\S]*?class="planet-sidebar-search"/u);
  assert.doesNotMatch(shell, /planet-sidebar-search-submit/u);
  assert.doesNotMatch(rail, /explorer-rail-item-logo|css-earth-logo@4x\.png/u);
  assert.doesNotMatch(rail, /Explore Cosmos|Explore<br \/>Cosmos/u);
  assert.match(rail, /import MaterialSymbol from "\.\/MaterialSymbol\.astro";/u);
  assert.match(rail, /explorer-rail-explore"[\s\S]*?aria-label="Planet information"[\s\S]*?<MaterialSymbol name="explore" \/>/u);
  assert.match(rail, /explorer-rail-about"[\s\S]*?aria-label="About"[\s\S]*?<MaterialSymbol name="help" \/>/u);
  assert.doesNotMatch(rail, /ExplorerRailBrand|explorer-rail-brand/u);
  assert.match(railStyles, /\.explorer-rail\s*\{[^}]*flex-direction:\s*row;[^}]*gap:\s*var\(--explorer-rail-item-gap\);[^}]*padding:\s*0;[^}]*border-radius:\s*12px;[^}]*background:\s*transparent;/u);
  assert.doesNotMatch(railStyles, /\.explorer-rail\s*\{[^}]*border-right/u);
  assert.doesNotMatch(railStyles, /\.explorer-rail-brand/u);
  assert.match(rail, /class="explorer-rail-button planet-settings-action"/u);
  assert.match(rail, /explorer-rail-about[\s\S]*?aria-label="About"[\s\S]*?planet-settings-action[\s\S]*?aria-label="Settings"[\s\S]*?<MaterialSymbol name="settings" \/>/u);
  assert.doesNotMatch(rail, /settings-marker/u);
  assert.doesNotMatch(rail + shell, /explorer-rail-saved|explorer-saved-panel|aria-label="Saved"|MaterialSymbol name="bookmark"/u);
  assert.doesNotMatch(rail, /<span>(?:Explore|Saved|Settings|About)<\/span>|explorer-rail-label/u);
  assert.doesNotMatch(rail, /CssEarthWordmark/u);
  assert.match(rail, /<nav[^>]*>\s*<button[\s\S]*?explorer-rail-explore[\s\S]*?explorer-rail-about[\s\S]*?planet-settings-action[\s\S]*?<\/button>\s*<\/nav>/u);
  assert.doesNotMatch(rail + railStyles, /explorer-rail-bottom-actions/u);
  assert.doesNotMatch(rail, /explorer-rail-menu/u);
  assert.doesNotMatch(rail + client, /createSidebarController|planet-sidebar-toggle/u);
  assert.match(navigation, /positionPlanetsByDistance\(PLANET_NAVIGATION_OBJECTS\)/u);
  assert.doesNotMatch(navigation, /requireObject\("sun"\)|scale-sun|href=\{sun\.route\}/u);
  assert.match(navigation, /positionedPlanets\.map/u);
  assert.match(navigation, /href=\{planet\.route\}/u);
  assert.match(navigation, /aria-current=\{planet\.id === activeObjectId \? "page" : undefined\}/u);
  assert.match(navigation, /<PlanetNavigationMarker/u);
  assert.doesNotMatch(navigation, /<script|<details/u);
  assert.match(styles, /\.planetary-navigation\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*var\(--explorer-header-top\) 20px auto auto;[^}]*width:\s*calc\([^}]*100vw - var\(--explorer-panel-left\) - var\(--explorer-panel-width\) - 20px[^}]*\);[^}]*max-width:\s*800px;[^}]*margin:\s*0;/u);
  assert.match(styles, /\.scale-stops\s*\{[^}]*position:\s*relative;[^}]*margin:\s*0 28px;/u);
  assert.match(styles, /\.scale-stops::before\s*\{[^}]*left:\s*var\(--planet-track-start\);[^}]*height:\s*1px;[^}]*background:\s*rgb\(223 223 223 \/ 16%\);/u);
  assert.match(navigation, /class="scale-stops"[\s\S]*?style=\{`--planet-track-start:\$\{positionedPlanets\[0\]\.scalePositionPercent\}%`\}/u);
  assert.match(styles, /\.scale-planet\s*\{[^}]*left:\s*var\(--planet-offset\);/u);
  assert.doesNotMatch(styles, /\.scale-sun|sun-marker(?:@2x)?\.webp/u);
  assert.match(styles, /--planet-min-size:\s*6px/u);
  assert.match(styles, /\.scale-label\s*\{[^}]*opacity:\s*\.72;/u);
  assert.match(styles, /\.scale-stop\[aria-current="page"\] \.scale-label\s*\{[^}]*opacity:\s*1;/u);
  assert.match(styles, /\.scale-stop \.planet-navigation-marker > i\s*\{[^}]*width:\s*max\(var\(--planet-min-size\), var\(--planet-size\)\);[^}]*height:\s*max\(var\(--planet-min-size\), var\(--planet-size\)\);/u);
  assert.match(styles, /\.scale-stops\s*\{[^}]*margin:\s*0 28px;/u);
  assert.match(styles, /@media \(max-width:\s*1100px\), \(orientation:\s*portrait\)/u);
  assert.match(railStyles, /\.explorer-about-panel,\s*\.planet-sidebar > \.explorer-settings-panel/u);
  assert.match(
    shellStyles,
    /:is\([\s\S]*?\.planet-information-panel,[\s\S]*?\.explorer-about-panel,[\s\S]*?\.planet-sidebar > \.explorer-settings-panel[\s\S]*?\)\s*\{[^}]*--explorer-card-padding-inline-start:\s*var\(--explorer-card-padding-left, 20px\);[^}]*--explorer-card-padding-inline-end:\s*14px;[^}]*padding-block:\s*12px 0;[^}]*padding-inline:\s*0;[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--explorer-panel-background\);/u,
  );
  assert.match(
    railStyles,
    /\.explorer-about-panel h2,[\s\S]*?\.explorer-settings-panel h2\s*\{[^}]*padding:[^}]*11px[^}]*var\(--explorer-card-padding-inline-start\);[^}]*border-bottom:\s*1px solid rgb\(0 0 0 \/ 50%\);/u,
  );
  assert.match(
    railStyles,
    /\.explorer-about-panel h2\s*\{[^}]*padding-bottom:\s*0;[^}]*border-bottom:\s*0;/u,
  );
  assert.match(
    shell,
    /declare const __CSSEARTH_VERSION__: string;[\s\S]*?class="explorer-about-introduction">[\s\S]*?<p>A 3D CSS planetary explorer\.[\s\S]*?href="https:\/\/github\.com\/LayoutitStudio\/polycss">PolyCSS<\/a>, without a WebGL or canvas scene renderer\.<\/p>[\s\S]*?<p>It preprocesses planetary data into browser-ready textures, charts, and retained scene plans, then lets you orbit and inspect one planet at a time\.<\/p>[\s\S]*?class="explorer-about-links"[\s\S]*?<span>Version<\/span>[\s\S]*?>v\{__CSSEARTH_VERSION__\}<\/span>[\s\S]*?href="https:\/\/github\.com\/layoutit\/cssEarth">[\s\S]*?<span>Source code<\/span>[\s\S]*?class="explorer-about-link-destination">github\.com\/layoutit\/cssEarth<\/span>[\s\S]*?href="mailto:agustin@lowpoly\.gg">[\s\S]*?<span>Contact<\/span>[\s\S]*?class="explorer-about-link-destination">agustin@lowpoly\.gg<\/span>/u,
  );
  assert.match(buildConfig, /execSync\("git rev-list --count HEAD"[\s\S]*?return `0\.\$\{commitCount\}`;[\s\S]*?__CSSEARTH_VERSION__:\s*JSON\.stringify\(cssEarthVersion\(\)\)/u);
  assert.match(
    railStyles,
    /\.explorer-about-introduction\s*\{[^}]*display:\s*grid;[^}]*gap:\s*12px;[^}]*padding:\s*12px[^}]*16px[^}]*var\(--explorer-card-padding-inline-start\);[^}]*border-bottom:\s*1px solid rgb\(0 0 0 \/ 50%\);[^}]*font:\s*400 16px\/1\.4 var\(--shell-ui-font\);[\s\S]*?\.explorer-about-introduction p\s*\{[^}]*margin:\s*0;/u,
  );
  assert.match(
    railStyles,
    /\.explorer-about-introduction a\s*\{[^}]*color:\s*inherit;[^}]*text-decoration-color:\s*rgb\(184 187 196 \/ 55%\);/u,
  );
  assert.doesNotMatch(railStyles, /\.explorer-about[^}]*color:\s*#(?:b5d8fa|d3e9ff)/u);
  assert.match(
    railStyles,
    /\.explorer-about-links\s*\{[^}]*display:\s*grid;[\s\S]*?\.explorer-about-row\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between;[^}]*gap:\s*12px;[^}]*min-height:\s*45px;[^}]*border-bottom:\s*1px solid rgb\(0 0 0 \/ 50%\);[^}]*font:\s*400 13px\/18px var\(--shell-ui-font\);[^}]*text-transform:\s*uppercase;[\s\S]*?\.explorer-about-link-destination\s*\{[^}]*font:\s*400 13px\/18px var\(--shell-ui-font\);[^}]*text-align:\s*right;[^}]*text-transform:\s*none;/u,
  );
  assert.match(
    railStyles,
    /\.explorer-settings-panel \.planet-setting-control\s*\{[^}]*align-items:\s*center;[^}]*min-height:\s*45px;[^}]*padding:[^}]*var\(--explorer-card-padding-inline-start\);[^}]*border-bottom:\s*1px solid rgb\(0 0 0 \/ 50%\);[\s\S]*?\.explorer-settings-panel \.planet-setting-text\s*\{[^}]*color:\s*var\(--shell-text\);[^}]*font:\s*400 13px\/18px var\(--shell-ui-font\);[^}]*opacity:\s*1;[^}]*text-transform:\s*uppercase;[\s\S]*?\.explorer-settings-panel \.planet-setting-control::before\s*\{[^}]*content:\s*none;/u,
  );
  assert.match(
    railStyles,
    /\.explorer-settings-panel \.planet-setting-control:last-child\s*\{[^}]*border-bottom:\s*0;/u,
  );
  assert.match(
    railStyles,
    /\.explorer-about-link:focus-visible\s*\{[^}]*outline:\s*2px solid #b5d8fa;[^}]*outline-offset:\s*-2px;/u,
  );
  assert.doesNotMatch(railStyles, /min-height:\s*330px/u);
  assert.match(
    railStyles,
    /\.explorer-settings-panel \.planet-setting-switch\s*\{[^}]*grid-column:\s*3;[^}]*width:\s*32px;[^}]*height:\s*18px;[^}]*border-radius:\s*999px;[\s\S]*?\.explorer-settings-panel \.planet-setting-switch::before\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;[^}]*border-radius:\s*50%;[\s\S]*?input\[type="checkbox"\]:checked ~ \.planet-setting-switch::before\s*\{[^}]*transform:\s*translateX\(14px\);/u,
  );
  assert.match(
    shell,
    /planet-motion-setting-control[\s\S]*?planet-speed-setting-control[\s\S]*?shadowSetting[\s\S]*?planet-sky-contrast-setting-control/u,
  );
  assert.match(
    railStyles,
    /\.explorer-settings-panel \.planet-speed-setting-control\s*\{[^}]*grid-template-columns:\s*max-content minmax\(8px, 1fr\) 80px;[\s\S]*?\.planet-speed-setting\s*\{[^}]*grid-column:\s*3;[^}]*width:\s*80px;[^}]*accent-color:\s*#b5d8fa;[\s\S]*?\.planet-speed-setting:disabled/u,
  );
  assert.doesNotMatch(railStyles, /explorer-saved/u);
  assert.doesNotMatch(railStyles, /planet-settings-flyout|explorer-settings-top/u);
  assert.match(railStyles, /\.explorer-rail-button\s*\{[^}]*background:\s*transparent;[^}]*opacity:\s*\.55;/u);
  assert.match(railStyles, /\.explorer-rail-button\[aria-pressed="true"\]\s*\{[^}]*background:\s*transparent;[^}]*color:\s*inherit;[^}]*opacity:\s*1;/u);
  assert.doesNotMatch(railStyles, /\[aria-pressed="true"\] \.explorer-rail-icon/u);
  assert.match(railStyles, /\.explorer-rail-button\s*\{[^}]*flex:\s*0 0 40px;[^}]*width:\s*40px;[^}]*height:\s*48px;[^}]*border-radius:\s*12px;/u);
  assert.doesNotMatch(railStyles, /\.explorer-rail-explore\s*\{/u);
  assert.doesNotMatch(railStyles, /\.explorer-rail-item-logo\s*\{/u);
  assert.match(railStyles, /\.explorer-rail-icon \.material-symbol\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*fill:\s*currentColor;[^}]*stroke:\s*none;/u);
  assert.match(mapsStyles, /\.planet-sidebar-search-icon\s*\{[^}]*left:\s*16px;[^}]*width:\s*24px;[^}]*height:\s*24px;/u);
  assert.match(mapsStyles, /\.planet-sidebar-search-icon \.search-icon\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;[^}]*fill:\s*none;[^}]*stroke:\s*currentColor;[^}]*stroke-width:\s*1\.8;/u);
  assert.match(railStyles, /\.explorer-rail-button:hover\s*\{[^}]*opacity:\s*\.8;/u);
  assert.doesNotMatch(railStyles, /\.explorer-rail-button:hover\s*\{[^}]*background:/u);
  assert.match(materialSymbol, /MATERIAL_SYMBOLS_OUTLINED\.icons\[name\][\s\S]*?class="material-symbol"[\s\S]*?data-material-symbol=\{name\}[\s\S]*?<path d=\{symbol\.path\} \/>/u);
  assert.match(materialSources, /family:\s*"Material Symbols Outlined"[\s\S]*?license:\s*"Apache License 2\.0"[\s\S]*?sourceCommit:\s*"0cbb08816df07faaae3dca060d4ebb10b66c214f"/u);
  for (const name of ["explore", "help", "settings"]) {
    assert.match(materialSources, new RegExp(`${name}: Object\\.freeze\\(\\{[\\s\\S]*?sourceSha256: "[0-9a-f]{64}"`, "u"));
  }
});

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
  const mount = () => createExplorerRailController(documentTarget, windowTarget);
  const elements = Object.fromEntries(Object.entries(nodes).map(([key, { node }]) => [key, node]));
  const escape = () => {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperty(event, "key", { value: "Escape" });
    documentTarget.dispatchEvent(event);
    return event;
  };
  return { ...elements, documentTarget, windowTarget, mount, scrolls, escape };
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
  assert.equal(f.search.hidden, true);
  assert.equal(f.about.ariaPressed, "true");
  assert.equal(f.aside.ariaLabel, "About cssEarth");
  assert.deepEqual(f.scrolls, []);
  f.explore.click();
  assert.equal(f.panel.hidden, true);
  assert.equal(f.drawer.hidden, false);
  assert.equal(f.search.hidden, false);
  assert.equal(f.documentTarget.activeElement, f.searchInput);
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
  assert.equal(f.search.hidden, true);
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

test("settings stays selected on repeat clicks and closes through About, Planet information, or Escape", () => {
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

test("search belongs only to Planet information while About and Settings own their cards", () => {
  const f = fixture();
  const controller = f.mount();
  assert.equal(f.search.hidden, false);
  f.about.click();
  assert.equal(f.search.hidden, true);
  assert.equal(f.panel.hidden, false);
  f.settings.click();
  assert.equal(f.search.hidden, true);
  assert.equal(f.settingsPanel.hidden, false);
  f.explore.click();
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
