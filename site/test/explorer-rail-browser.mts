import { createTestPage } from './browser-observations.mts';
import { required } from './navigation-test-values.mts';
import type { Locator } from 'playwright';
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { SCENE_OBJECTS } from "../objects.mts";
import { browserObjects } from './browser-objects.mts';

const baseUrl = process.argv[2] ?? "http://127.0.0.1:4210";
const output = process.argv[3] ? resolve(process.argv[3]) : null;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
console.log(`Chrome ${browser.version()} (channel chrome, headless); ${baseUrl}`);
const cases: { label: string; route: string; width: number; height: number; density: number; mobile?: boolean }[] = [
  ...browserObjects().map(({ id, route }) => ({
    label: `${id}-desktop`, route, width: 1440, height: 960, density: 1,
  })),
  { label: "desktop-dpr2", route: "/saturn/", width: 1440, height: 960, density: 2 },
  { label: "phone-dpr2", route: "/saturn/", width: 390, height: 844, density: 2, mobile: true },
  { label: "tablet-portrait", route: "/earth/", width: 1024, height: 1366, density: 1, mobile: true },
  { label: "small-landscape", route: "/saturn/", width: 900, height: 600, density: 1 },
  { label: "narrow-desktop", route: "/saturn/", width: 1160, height: 800, density: 1 },
  { label: "small-phone", route: "/saturn/", width: 320, height: 568, density: 1, mobile: true },
];

try {
  for (const config of cases.filter(({ label }) => !process.env.CSSEARTH_RAIL_CASE || label === process.env.CSSEARTH_RAIL_CASE)) {
    const page = await createTestPage(browser, {
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: config.density,
      hasTouch: Boolean(config.mobile),
      isMobile: Boolean(config.mobile),
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(new URL(config.route, baseUrl).href);
    await page.waitForFunction(() => document.querySelector(".planet-stage")?.getAttribute("aria-busy") === "false");
    const rail = page.getByRole("navigation", { name: "Explorer", exact: true });
    assert.equal(await page.locator(".planetary-navigation").count(), 0,
      `${config.label}: the retired top planet navigation is not rendered`);
    const settings = rail.locator(".planet-settings-action");
    const about = rail.getByRole("button", { name: "About", exact: true });
    const explore = rail.getByRole("button", { name: "Planet information", exact: true });
    const search = page.locator(".planet-sidebar-search");
    const assertActiveTreatment = async (button: Locator) => {
      const actual = await button.evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, opacity: style.opacity };
      });
      assert.deepEqual(actual, { background: "rgba(0, 0, 0, 0)", opacity: "1" });
      assert.equal(await button.locator(".explorer-rail-icon").evaluate((node) =>
        getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
    };
    const panel = page.locator(".explorer-about-panel");
    const sidebar = page.locator(".planet-sidebar");
    const drawer = page.locator(".planet-drawer-content");
    const cardTreatment = (locator: Locator) => locator.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        padding: style.padding,
        borderRadius: style.borderRadius,
        background: style.backgroundColor,
        color: style.color,
        font: style.font,
        boxShadow: style.boxShadow,
      };
    });
    const planetCardTreatment = await cardTreatment(page.locator(".planet-information-panel"));
    const roots = await page.locator(".planet-stage > .planet-render-root").elementHandles();
    assert.ok(roots.length > 0, `${config.label}: mounted scene layers`);
    const rootCount = roots.length;
    const activeObject = required(SCENE_OBJECTS.find(object => object.route === config.route));
    const systemTag = page.locator(".planet-system-tag");
    const classificationTag = page.locator(".planet-classification-tag");
    const tagLabel = await classificationTag.innerText();
    assert.equal(await page.locator('[data-fact-id="classification"]').count(), 0);
    const tagBox = required(await classificationTag.boundingBox());
    const titleBox = required(await page.locator(".planet-title").boundingBox());
    assert.ok(tagBox.x >= titleBox.x + titleBox.width && tagBox.y >= titleBox.y &&
      tagBox.y + tagBox.height <= titleBox.y + titleBox.height + 1,
      `${config.label}: classification tag fits beside the title`);
    const beforeBrowseUrl = page.url();
    assert.equal(await systemTag.innerText(), activeObject.systemName);
    await systemTag.click();
    assert.equal(await search.inputValue(), activeObject.systemName);
    const visibleObjects = () => page.locator('.planet-object-item:not([hidden]) [data-object-id]')
      .evaluateAll(links => links.map(link => link.dataset.objectId).sort());
    assert.deepEqual(await visibleObjects(), SCENE_OBJECTS.filter(object =>
      object.systemName === activeObject.systemName).map(object => object.id).sort());
    assert.equal(page.url(), beforeBrowseUrl, "browsing a system does not navigate");
    await search.press("Escape");
    await classificationTag.focus();
    await page.keyboard.press("Enter");
    assert.equal(await search.inputValue(), `${tagLabel}s`);
    assert.deepEqual(await visibleObjects(), SCENE_OBJECTS.filter(object =>
      object.classification === activeObject.classification).map(object => object.id).sort());
    assert.equal(page.url(), beforeBrowseUrl, "browsing a classification does not navigate");
    assert.equal(await page.locator('.planet-destination-results').isVisible(), false,
      "classification browsing does not start city search");
    await search.fill("planets");
    assert.deepEqual(await visibleObjects(), SCENE_OBJECTS.filter(object =>
      object.classification === "planet").map(object => object.id).sort(), "planets excludes dwarf planets");
    await search.fill("ceres");
    assert.deepEqual(await visibleObjects(), ["ceres"], "typing a name replaces the classification query");
    await search.press("Escape");
    assert.equal(await classificationTag.isVisible(), true);
    assert.equal(await search.inputValue(), activeObject.name);
    assert.ok((await Promise.all(roots.map(root => root.evaluate(node => node.isConnected)))).every(Boolean),
      "badge browsing retains the current scene");
    const railBox = required(await rail.boundingBox());
    const headerBox = required(await page.locator(".explorer-shell-header").boundingBox());
    assert.ok(railBox, `${config.label}: visible rail`);
    assert.ok(headerBox, `${config.label}: visible header`);
    assert.equal(railBox.width, 120);
    assert.equal(railBox.y, 8);
    assert.equal(railBox.height, 48);
    assert.equal(await rail.evaluate((node) => getComputedStyle(node).backgroundColor), "rgba(0, 0, 0, 0)");
    assert.equal(await rail.evaluate((node) => getComputedStyle(node).borderRadius), "12px");
    const wordmark = page.locator(".explorer-shell-wordmark");
    const wordmarkLink = wordmark.locator(".maps-brand-button");
    const wordmarkBox = required(await wordmark.boundingBox());
    const wordmarkLinkBox = required(await wordmarkLink.boundingBox());
    assert.equal(wordmarkBox.x, 16);
    assert.equal(wordmarkBox.y, railBox.y);
    assert.equal(wordmarkBox.height, railBox.height);
    assert.ok(Math.abs(railBox.x + railBox.width - (headerBox.x + headerBox.width)) < 0.1,
      "the horizontal rail ends at the card edge");
    assert.ok(headerBox.x + headerBox.width <= config.width - 8 + 0.1,
      `${config.label}: the header controls stay inside the viewport`);
    assert.ok(Math.abs(wordmarkLinkBox.x - 16) < 0.1,
      "the cssEarth wordmark starts 16px from the viewport left");
    const sidebarBox = required(await sidebar.boundingBox());
    assert.equal(sidebarBox.x, 12);
    assert.equal(await page.locator(".planet-sidebar-search").evaluate((node) =>
      getComputedStyle(node).borderRadius), "12px");
    assert.equal(await page.locator(".planet-information-panel").evaluate((node) =>
      getComputedStyle(node).borderRadius), "8px");
    if (!config.mobile) {
      assert.equal(sidebarBox.y, 0, "search starts at the top of the information rail");
      assert.equal((required(await page.locator(".planet-sidebar-search-card").boundingBox())).y, 68,
        "search follows the 48px header by 12px");
      assert.ok(sidebarBox.y + sidebarBox.height <= config.height - 16,
        "the information panel leaves a bottom gap");
      assert.equal((required(await page.locator(".planet-stage").boundingBox())).x, 0,
        "the floating shell does not reserve scene space");
    }
    assert.equal(await page.locator(".planet-sidebar-toggle, .planetary-navigation-toggle, .explorer-rail-menu").count(), 0);
    const factsheetPanel = page.locator(".planet-factsheet-section");
    const factsheetSummary = factsheetPanel.locator(":scope > .planet-factsheet-header");
    const factsheetIcon = factsheetSummary.locator('.planet-panel-icon[data-panel-icon="facts"]');
    assert.equal(await factsheetIcon.evaluate((node) => node.tagName), "IMG");
    assert.match(required(await factsheetIcon.getAttribute("src")), /\/shell\/icon-facts\.svg$/u);
    const factsheetInitiallyOpen = await factsheetPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open);
    assert.equal(factsheetInitiallyOpen, false,
      `${config.label}: Factsheet starts collapsed`);
    assert.equal(await factsheetPanel.evaluate((node) => getComputedStyle(node).paddingBottom), "0px",
      `${config.label}: collapsed Factsheet leaves no empty bottom gap`);
    await factsheetSummary.click();
    assert.equal(await factsheetPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open), !factsheetInitiallyOpen,
      `${config.label}: Factsheet header toggles the whole panel`);
    assert.equal(await factsheetPanel.evaluate((node) => getComputedStyle(node).paddingBottom), "16px",
      `${config.label}: expanded Factsheet restores its content spacing`);
    assert.equal(await factsheetPanel.locator(".planet-primary-facts > li").count(), 4,
      `${config.label}: Factsheet previews four facts`);
    const factsOverflow = factsheetPanel.locator(".planet-facts-overflow");
    const factsToggle = factsOverflow.locator(":scope > .planet-facts-toggle");
    assert.equal(await factsOverflow.evaluate((node) => window.__cssearthTest.detailsElement(node).open), false,
      `${config.label}: remaining facts start hidden`);
    assert.equal(await factsToggle.innerText(), "View more");
    await factsToggle.click();
    assert.equal(await factsOverflow.evaluate((node) => window.__cssearthTest.detailsElement(node).open), true,
      `${config.label}: View more reveals remaining facts`);
    assert.equal(await factsToggle.innerText(), "View less");
    await factsheetSummary.click();
    assert.equal(await factsheetPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open), factsheetInitiallyOpen,
      `${config.label}: Factsheet returns to its initial state`);
    const chartSwitcher = page.locator(".planet-chart-switcher");
    if (await chartSwitcher.count() > 0) {
      assert.equal(await chartSwitcher.isVisible(), false,
        `${config.label}: Charts stays hidden while its prepared content is retained`);
      const chartSlides = chartSwitcher.locator(".planet-chart-slide");
      assert.ok(await chartSlides.count() > 0,
        `${config.label}: prepared chart nodes remain mounted`);
      assert.equal(await chartSwitcher.getAttribute("data-active-chart"), "reflectance",
        `${config.label}: the default chart remains Reflectance`);
    }
    const lensPanel = page.locator(".planet-lenses");
    if (await lensPanel.count() > 0) {
      const lensHeading = lensPanel.locator(":scope > .planet-lens-browser-header .planet-panel-heading");
      assert.equal(await lensPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open), true,
        `${config.label}: Dataset starts open`);
      await lensHeading.click();
      assert.equal(await lensPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open), false,
        `${config.label}: Dataset title collapses the list`);
      await lensHeading.click();
      assert.equal(await lensPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open), true,
        `${config.label}: Dataset title expands the list`);
      await lensPanel.locator(".planet-lens-search").click();
      assert.equal(await lensPanel.evaluate((node) => window.__cssearthTest.detailsElement(node).open), true,
        `${config.label}: focusing lens search does not collapse its panel`);
      if (config.label === "mercury-desktop") {
        const legend = page.locator('[data-lens-legend="topography"]');
        const interiorLegend = page.locator('[data-lens-legend="interior"]');
        const enhanced = lensPanel.locator('button[name="dataset"][value="enhanced"]');
        const topography = lensPanel.locator('button[name="dataset"][value="topography"]');
        const interior = lensPanel.locator('button[name="dataset"][value="interior"]');
        const normal = lensPanel.locator('button[name="dataset"][value="normal"]');
        assert.equal(await page.locator("[data-lens-legend]").count(), 2,
          "Mercury retains only its meaningful Topography and Interior legends");
        assert.equal(await page.locator(".planet-drawer-content > [data-lens-legend]").count(), 0,
          "Surface Lens has no detached legend card");
        assert.equal(await page.locator(".planet-lens-details [data-lens-legend]").count(), 2,
          "each optional legend is retained inside Surface Lens");
        assert.equal(await page.locator("[data-lens-legend]:visible").count(), 0,
          "Mercury default 750 nm lens does not show a legend");
        await enhanced.click();
        await page.waitForFunction(() =>
          document.querySelector('button[name="dataset"][value="enhanced"]')
            ?.getAttribute("aria-pressed") === "true");
        assert.equal(await page.locator("[data-lens-legend]:visible").count(), 0,
          "Mercury Enhanced does not present channel construction as a viewing legend");
        assert.equal(await enhanced.getAttribute("aria-expanded"), null,
          "Enhanced is a lens choice, not a legend accordion");
        await topography.click();
        await page.waitForFunction(() =>
          document.querySelector('button[name="dataset"][value="topography"]')
            ?.getAttribute("aria-pressed") === "true");
        assert.equal(await legend.isVisible(), true,
          "Mercury Topography lens shows its elevation legend");
        assert.equal(await legend.locator(".planet-lens-legend-scale-row").evaluate((node) =>
          getComputedStyle(node).height), "24px",
        "scale legends share the same first-row height as category legends");
        assert.deepEqual(await legend.evaluate((node) => {
          const style = getComputedStyle(node);
          return { paddingTop: style.paddingTop, paddingBottom: style.paddingBottom };
        }), { paddingTop: "8px", paddingBottom: "0px" },
        "Surface Lens legends use the shared compact spacing");
        assert.match(await legend.innerText(), /−5,020[\s\S]*−450[\s\S]*4,140 m/u);
        await interior.click();
        await page.waitForFunction(() =>
          document.querySelector('button[name="dataset"][value="interior"]')
            ?.getAttribute("aria-pressed") === "true");
        assert.equal(await legend.isVisible(), false,
          "switching away hides the Topography legend");
        assert.equal(await interiorLegend.isVisible(), true,
          "Mercury Interior lens shows its category legend");
        assert.match(await interiorLegend.innerText(), /Metallic core[\s\S]*85% of radius[\s\S]*Mantle \+ crust[\s\S]*366 km shell/u);
        await normal.click();
        await page.waitForFunction(() =>
          document.querySelector('button[name="dataset"][value="normal"]')
            ?.getAttribute("aria-pressed") === "true");
        assert.equal(await page.locator("[data-lens-legend]:visible").count(), 0,
          "returning to 750 nm hides every optional legend");
      }
    }
    assert.equal(await page.locator(".planet-topbar").count(), 0, "branding belongs to the shell, not a separate header");
    assert.equal(await rail.locator(".maps-brand-button").count(), 0);
    assert.equal(await page.locator(".planet-brand-footer").count(), 0);
    assert.equal(await page.locator(".planet-wordmark-version").count(), 0);
    assert.equal(await rail.locator("button").evaluateAll((nodes) => nodes.every((node) => window.__cssearthTest.htmlElement(node).innerText.trim() === "")), true);
    assert.equal(await page.locator(".explorer-rail-saved, .explorer-saved-panel").count(), 0);
    assert.equal(await page.locator(".explorer-milky-way-panel").count(), 0);
    for (const button of [settings, about, explore]) {
      const box = required(await button.boundingBox());
      assert.ok(box.width >= 40 && box.height >= 44, "compact horizontal target");
    }
    const previousUrl = page.url();
    await explore.click();
    assert.equal(page.url(), previousUrl);
    assert.equal(await drawer.isVisible(), true);
    assert.equal(await search.isVisible(), true);
    assert.equal(await search.evaluate((node) => node === document.activeElement), true);
    await assertActiveTreatment(explore);
    assert.equal(await panel.isVisible(), false);
    await about.click();
    assert.equal(await panel.isVisible(), true);
    assert.equal(await drawer.isVisible(), false);
    assert.equal(await search.isVisible(), false);
    assert.equal(await about.getAttribute("aria-pressed"), "true");
    await assertActiveTreatment(about);
    const aboutBox = required(await panel.boundingBox());
    assert.deepEqual(await cardTreatment(panel), planetCardTreatment,
      `${config.label}: About uses the Planet card treatment`);
    await about.click();
    assert.match(await panel.innerText(),
      /A 3D CSS planetary explorer[\s\S]*orbit and inspect one planet at a time[\s\S]*VERSION[\s\S]*v0\.\d+[\s\S]*SOURCE CODE[\s\S]*github\.com\/layoutit\/cssEarth[\s\S]*CONTACT[\s\S]*agustin@lowpoly\.gg/u);
    assert.equal(await panel.getByRole("link", { name: "Source code" })
      .getAttribute("href"), "https://github.com/layoutit/cssEarth");
    assert.equal(await panel.getByRole("link", { name: "Contact" })
      .getAttribute("href"), "mailto:agustin@lowpoly.gg");
    if (output && ["saturn-desktop", "phone-dpr2"].includes(config.label)) {
      await page.screenshot({ path: `${output}/${config.label}-about.png` });
    }
    assert.equal(await sidebar.isVisible(), true);
    assert.equal(await sidebar.isVisible(), true);
    await about.click();
    assert.equal(await sidebar.isVisible(), true);
    await explore.click();
    assert.equal(await drawer.isVisible(), true);
    assert.equal(await search.evaluate((node) => node === document.activeElement), true);
    await about.focus();
    await page.keyboard.press("Enter");
    assert.equal(await panel.isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await panel.isVisible(), false);
    assert.equal(await about.evaluate((node) => node === document.activeElement), true);
    await about.click();
    await settings.click();
    assert.equal(await drawer.isVisible(), false);
    const settingsPanel = page.locator(".planet-settings-panel");
    assert.equal(await settingsPanel.isVisible(), true);
    assert.equal(await panel.isVisible(), false);
    assert.equal(await page.locator(".planet-sidebar-search-card").isVisible(), false);
    assert.equal(await settings.getAttribute("aria-pressed"), "true");
    await assertActiveTreatment(settings);
    assert.equal(await about.getAttribute("aria-pressed"), "false");
    assert.equal(await settingsPanel.evaluate((node) => window.__cssearthTest.required(node.parentElement, 'panel parent').matches(".planet-sidebar")), true);
    const settingsBox = required(await settingsPanel.boundingBox());
    assert.deepEqual(await cardTreatment(settingsPanel), planetCardTreatment,
      `${config.label}: Settings uses the Planet card treatment`);
    for (const dimension of ["x", "width"] as const) {
      assert.ok(Math.abs(settingsBox[dimension] - aboutBox[dimension]) < 1,
        `${config.label}: Settings and About share panel ${dimension}`);
    }
    assert.ok(Math.abs(settingsBox.y - aboutBox.y) < 1, "Settings and About share the panel top edge");
    assert.equal(await settingsPanel.evaluate((node) => getComputedStyle(node).position), "static");
    assert.ok(Math.abs(settingsBox.x - sidebarBox.x) < 1 && settingsBox.x + settingsBox.width <= config.width);
    assert.ok(settingsBox.y >= 0);
    if (!config.mobile) assert.ok(settingsBox.y + settingsBox.height <= config.height);
    else assert.ok(settingsBox.y + settingsBox.height <= await page.evaluate(() => document.documentElement.scrollHeight),
      "short portrait pages can scroll to the full settings panel below shared search");
    assert.equal(await settingsPanel.locator(".planet-motion-setting-control").isVisible(), true);
    assert.equal(await settingsPanel.locator(".planet-setting-control:last-child").evaluate((node) =>
      getComputedStyle(node).borderBottomWidth), "0px",
    `${config.label}: Settings has no trailing divider`);
    if (config.mobile) {
      assert.notEqual(await settingsPanel.evaluate((node) => getComputedStyle(node).minHeight), "330px",
        `${config.label}: Settings no longer reserves a fixed mobile height`);
    }
    const toggleRows = settingsPanel.locator(
      "label.planet-setting-control:has(.planet-setting-switch)",
    );
    assert.ok(await toggleRows.count() >= 2, `${config.label}: checkbox settings use switches`);
    const toggleAlignment = await toggleRows.evaluateAll((rows) => rows.map((row) => {
      const label = row.querySelector(".planet-setting-text");
      const control = row.querySelector(".planet-setting-switch");
      const labelBox = window.__cssearthTest.required(label, 'toggle label').getBoundingClientRect();
      const controlBox = window.__cssearthTest.required(control, 'toggle control').getBoundingClientRect();
      return {
        delta: Math.abs(
          labelBox.top + labelBox.height / 2 -
          (controlBox.top + controlBox.height / 2),
        ),
        textTransform: getComputedStyle(window.__cssearthTest.required(label, 'computed style element')).textTransform,
      };
    }));
    assert.equal(toggleAlignment.every(({ delta }) => delta < 1), true,
      `${config.label}: switch and label centers align`);
    assert.equal(toggleAlignment.every(({ textTransform }) => textTransform === "uppercase"), true,
      `${config.label}: setting labels use the section-label treatment`);
    const motion = settingsPanel.locator(".planet-motion-setting");
    const speedControl = settingsPanel.locator(".planet-speed-setting-control");
    const speed = speedControl.locator('.planet-speed-setting[type="range"]');
    assert.equal(await settingsPanel.locator(".planet-motion-setting-control").evaluate((node) =>
      getComputedStyle(window.__cssearthTest.required(node.querySelector(".planet-setting-text"), 'computed style element')).opacity), "1",
    `${config.label}: enabled setting labels use full opacity`);
    if (await speedControl.count() > 0) {
      assert.ok(Number(await speedControl.evaluate((node) => getComputedStyle(node).opacity)) < 1,
        `${config.label}: disabled Speed row remains dimmed`);
      assert.equal(await speedControl.evaluate((node) => {
        const next = node.nextElementSibling;
        const minimap = next?.querySelector('input[name="shadows"]')
          ? next.nextElementSibling
          : next;
        return node.previousElementSibling?.matches(".planet-motion-setting-control") === true &&
          minimap?.matches(".planet-minimap-setting-control") === true &&
          minimap.nextElementSibling?.matches(".planet-surface-labels-setting-control") === true;
      }), true, `${config.label}: Motion and Speed are consecutive; Minimap precedes Surface labels`);
      assert.equal(await speed.isDisabled(), !(await motion.isChecked()),
        `${config.label}: Motion controls Speed availability`);
      await settingsPanel.locator(".planet-motion-setting-control").click();
      assert.equal(await speed.isEnabled(), true,
        `${config.label}: enabling Motion enables Speed`);
      assert.equal(await speedControl.evaluate((node) => getComputedStyle(node).opacity), "1",
        `${config.label}: enabled Speed label returns to full opacity`);
      await speed.fill("2");
      assert.equal(await speed.getAttribute("data-state"), "fast",
        `${config.label}: Speed exposes five stepped values`);
      await settingsPanel.locator(".planet-motion-setting-control").click();
      assert.equal(await speed.isDisabled(), true,
        `${config.label}: disabling Motion disables Speed`);
      assert.ok(Number(await speedControl.evaluate((node) => getComputedStyle(node).opacity)) < 1,
        `${config.label}: disabling Motion dims the Speed label again`);
    }
    await settings.click();
    assert.equal(await settingsPanel.isVisible(), true, "clicking the selected rail item keeps its panel open");
    const surfaceLabels = settingsPanel.locator(".planet-surface-labels-setting");
    const surfaceLabelsSwitch = settingsPanel.locator(".planet-surface-labels-setting-control .planet-setting-switch");
    assert.equal(await surfaceLabels.isChecked(), false, "Surface labels starts off");
    const offThumbTransform = await surfaceLabelsSwitch.evaluate((node) => getComputedStyle(node, "::before").transform);
    await settingsPanel.locator(".planet-surface-labels-setting-control").click();
    assert.equal(await surfaceLabels.isChecked(), true);
    assert.notEqual(await surfaceLabelsSwitch.evaluate((node) => getComputedStyle(node, "::before").transform), offThumbTransform,
      `${config.label}: checked switch moves its thumb`);
    await about.click();
    assert.equal(await settingsPanel.isVisible(), false);
    assert.equal(await settings.getAttribute("aria-pressed"), "false");
    await settings.focus();
    await page.keyboard.press("Enter");
    assert.equal(await surfaceLabels.isChecked(), true, "switching panels retains settings values");
    await settingsPanel.locator(".planet-surface-labels-setting-control").click();
    if (output && ["jupiter-desktop", "saturn-desktop", "phone-dpr2", "small-phone"].includes(config.label)) {
      await page.screenshot({ path: `${output}/${config.label}-settings.png` });
    }
    await page.keyboard.press("Escape");
    assert.equal(await settingsPanel.isVisible(), false);
    assert.equal(await settings.evaluate((node) => node === document.activeElement), true);
    await settings.click();
    await explore.click();
    assert.equal(await settingsPanel.isVisible(), false);
    for (const action of [about, settings]) {
      await action.click();
      assert.equal(await search.isVisible(), false);
      await explore.click();
      assert.equal(await search.isVisible(), true);
      await search.fill("Mars");
      assert.equal(await page.locator('.planet-object-item[data-object-name="mars"]').isVisible(), true);
      assert.equal(await explore.getAttribute("aria-pressed"), "true");
      await search.press("Escape");
    }
    await search.fill("Mars");
    const result = page.locator('.planet-object-item[data-object-name="mars"]');
    assert.equal(await result.isVisible(), true);
    await search.press("Escape");
    assert.equal(await page.locator(".planet-information-panel").isVisible(), true);
    for (const [index, root] of roots.entries()) {
      assert.equal(await root.evaluate((node, position) =>
        node.isConnected && node === document.querySelectorAll(".planet-stage > .planet-render-root")[position], index), true,
      `${config.label}: rail interactions retain scene layer identity`);
    }
    assert.equal(await page.locator(".planet-stage").count(), 1);
    assert.equal(await page.locator(".planet-stage > .planet-render-root").count(), rootCount);
    assert.equal(await page.locator(
      ".planet-attribution-footer .planet-camera-coordinates, " +
      ".planet-attribution-footer .planet-camera-copy",
    ).count(), 0, "camera metadata is not part of the source footer");
    const attributionFooter = page.locator(".planet-attribution-footer");
    assert.equal(await attributionFooter.locator(".planet-attribution-developed").count(), 0,
      "the source footer has no developer credit");
    assert.equal(await attributionFooter.locator(":scope > .planet-attribution-separator:last-child").count(), 0,
      "the source footer has no trailing separator");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (config.mobile) {
      assert.equal(await attributionFooter.isVisible(), true,
        `${config.label}: the mobile footer retains the Sources link`);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await about.click();
      assert.equal(await page.evaluate(() => window.scrollY), 0);
      await explore.click();
    }
    if (output && ["jupiter-desktop", "saturn-desktop", "desktop-dpr2", "phone-dpr2"].includes(config.label)) {
      await page.screenshot({ path: `${output}/${config.label}.png` });
    }
    // The shared router tears down and remounts controllers on bfcache restore.
    await about.click();
    await page.evaluate(() => {
      for (const type of ["pagehide", "pageshow"]) {
        window.dispatchEvent(new PageTransitionEvent(type, { persisted: true }));
      }
    });
    await page.waitForFunction(() => document.querySelector(".planet-stage")?.getAttribute("aria-busy") === "false");
    await about.click();
    assert.equal(await panel.isVisible(), true);
    await explore.click();
    assert.equal(await drawer.isVisible(), true);
    assert.equal(await page.locator(".planet-stage > .planet-render-root").count(), rootCount);
    assert.deepEqual(errors, [], `${config.label}: no page errors`);
    await page.close();
    console.log(`PASS ${config.label}`);
  }
} finally {
  await browser.close();
}
