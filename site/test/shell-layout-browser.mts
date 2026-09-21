import { required } from '../../tools/test-values.mts';
import { dictionary, shape, number } from '../../tools/objects/terrestrial-layers/source-records.mts';
import { createTestPage } from './browser-observations.mts';
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

// Capture the accepted layout before a structural change, then compare its geometry.
const captureBefore = process.argv.includes("--capture-before");
const compareBaseline = process.argv.includes("--compare-baseline");
const baseUrl = process.argv[2] ?? process.env.CSSEARTH_LAYOUT_URL ?? "http://127.0.0.1:4210";
const output = resolve("output/playwright/layout-foundation");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const cases = [
  { name: "desktop", width: 1280, height: 720, density: 1 },
  { name: "desktop-dpr2", width: 1440, height: 960, density: 2 },
  { name: "small-landscape", width: 900, height: 600, density: 1 },
  { name: "phone", width: 390, height: 844, density: 2 },
  { name: "tablet", width: 1024, height: 1366, density: 1 },
];
const selectors = [
  ".explorer-shell-header", ".explorer-shell-wordmark", ".maps-brand-button",
  ".planet-sidebar", ".planet-sidebar-search", ".planet-search-categories",
  ".planet-information-panel", ".planet-information-panel .planet-title", ".planet-information-panel .planet-introduction",
  ".planet-panel-summary", ".planet-lens-icon", ".planet-stage", ".planet-viewport",
];

try {
  for (const config of cases) {
    // Phones and portrait tablets carry the sheet; every other case is the dock.
    const sheetLayout = config.width <= 820 || config.height >= config.width;
    const page = await createTestPage(browser, {
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: config.density,
      hasTouch: sheetLayout,
      isMobile: sheetLayout,
    });
    await page.goto(`${baseUrl}/jupiter/`);
    await page.waitForFunction(() => document.querySelector(".planet-stage")?.getAttribute("aria-busy") === "false");
    const geometry = await page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
      const node = window.__cssearthTest.element(selector);
      const { x, y, width, height } = node.getBoundingClientRect();
      return [selector, { x, y, width, height }];
    })), selectors);
    const beforePath = `${output}/${config.name}-before.json`;
    if (captureBefore) {
      await writeFile(beforePath, JSON.stringify(geometry, null, 2));
    } else if (compareBaseline) {
      const before = dictionary(shape({x:number,y:number,width:number,height:number}))(JSON.parse(await readFile(beforePath, "utf8")));
      for (const selector of selectors) {
        for (const dimension of ["x", "y", "width", "height"] as const) {
          assert.ok(Math.abs(geometry[selector][dimension] - before[selector][dimension]) < 0.1,
            `${config.name} ${selector} ${dimension}: ${before[selector][dimension]} -> ${geometry[selector][dimension]}`);
        }
      }
    }
    await page.screenshot({ path: `${output}/${config.name}-${captureBefore ? "before" : "after"}.png` });
    if (!captureBefore) {
      const measure = () => page.evaluate(() => {
        const test = window.__cssearthTest;
        const box = (selector:string) => {const {x,y,width,height,left,top,right,bottom}=test.element(selector).getBoundingClientRect();return {x,y,width,height,left,top,right,bottom};};
        const shown = (selector:string) => test.element(selector).getClientRects().length > 0;
        const sidebar = box(".planet-sidebar");
        const sidebarStyle = getComputedStyle(test.required(test.element(".planet-sidebar"), "sidebar style"));
        return {
          header: box(".explorer-shell-header"), stage: box(".planet-stage"), sidebar,
          searchInHeader: test.element('.planet-sidebar-search').closest('.explorer-shell-header') !== null,
          sidebarFrame: box(".planet-sidebar-frame"),
          viewport: box(".planet-viewport"), input: box(".planet-input-surface"),
          overlays: box(".planet-scene-overlays"), status: box(".planet-view-readout"),
          sourcesShown: shown(".planet-attribution-footer"),
          minimapMounted: document.querySelectorAll(".space-minimap").length > 0,
          minimapShown: document.querySelectorAll(".space-minimap").length > 0
            && getComputedStyle(test.required(test.element(".space-minimap"), "minimap style")).display !== "none",
          minimapSettingShown: getComputedStyle(test.required(test.element(".planet-minimap-setting-control"), "minimap setting style")).display !== "none",
          isolated: getComputedStyle(test.required(test.element('.planet-viewport'), 'computed style element')).isolation === 'isolate',
          // The world presentation wraps the detail stage; the stage still has to live inside the viewport.
          sceneInViewport: test.element('.planet-stage').closest('.planet-viewport') !== null,
          sceneParent: test.required(test.element('.planet-stage').parentElement,'scene parent').className,
          uiInScene: test.element('.planet-stage').querySelectorAll('.planet-sidebar, .explorer-shell-header, .planet-view-readout, .space-minimap').length,
          wordmarkSlot: box(".explorer-shell-wordmark"),
          search: box(".planet-sidebar-search-card"), toolbar: box(".planet-search-toolbar"),
          categories: box(".planet-search-categories"), categoriesShown: shown(".planet-search-categories"),
          brand: box(".explorer-brand-row"), facilityAction: box(".planet-facility-action"),
          categoryCount: document.querySelectorAll(".planet-search-category").length,
          githubShown: shown(".planet-header-link"), github: box(".planet-header-link"),
          settings: box(".planet-settings-action"), facility: box(".planet-facility-toggle"),
          clearShown: shown(".planet-sidebar-search-clear"),
          card: box(".planet-information-panel"),
          // The sheet declares its snap heights; the controller reads the same values.
          sheetState: document.body.dataset.sheet ?? null,
          peek: parseFloat(sidebarStyle.getPropertyValue("--sheet-peek")),
          half: parseFloat(sidebarStyle.getPropertyValue("--sheet-half")),
          mountedLayers: document.querySelectorAll(".planet-stage > .polycss-camera").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
        };
      });
      const check = (result:Awaited<ReturnType<typeof measure>>) => {
        const near = (actual:number, expected:number, label:string) => assert.ok(Math.abs(actual - expected) < 0.08,
          `${config.name}: ${label}: ${actual} != ${expected}`);
        // The scene owns the whole window in every layout, with the shell over it.
        assert.deepEqual(result.stage, result.viewport, `${config.name}: scene fills its own viewport`);
        assert.deepEqual(result.input, result.viewport, `${config.name}: input uses the rendered viewport`);
        assert.deepEqual(result.overlays, result.viewport, `${config.name}: overlays share the bounded viewport`);
        assert.equal(result.sceneInViewport, true, `${config.name}: the scene renders inside the viewport`);
        assert.equal(result.sceneParent, 'planet-world-stage');
        assert.equal(result.isolated, true);
        assert.equal(result.uiInScene, 0, `${config.name}: UI stays outside the 3D scene`);
        near(result.stage.left, 0, "scene starts at the window edge");
        near(result.stage.width, config.width, "scene uses the full viewport width");
        near(result.stage.top, 0, "scene reaches the top of the window");
        near(result.stage.bottom, config.height, "scene reaches the bottom of the window");
        assert.equal(result.searchInHeader, true, `${config.name}: search belongs to the header`);
        assert.equal(result.categoryCount, 7, `${config.name}: seven category filters`);
        assert.ok(result.search.width > 120, `${config.name}: the search field keeps a usable width`);
        assert.equal(result.overflow, false, `${config.name}: no page overflow`);
        assert.equal(result.mountedLayers, 1, `${config.name}: exactly one camera remains mounted`);
        if (sheetLayout) {
          // The sheet rests at peek over a scene that fills the screen.
          assert.equal(result.pageScrolls, false, "the page itself never scrolls");
          assert.equal(result.sheetState, "peek", "the sheet opens at its peek height");
          near(result.sidebar.left, 0, "the sheet spans the window");
          near(result.sidebar.width, config.width, "the sheet spans the window width");
          near(result.sidebar.top, config.height - result.peek, "peek shows the declared height");
          assert.ok(result.header.top >= 0 && result.header.bottom <= result.sidebar.top,
            `${config.name}: the header clears the peeking sheet`);
          assert.equal(result.categoriesShown, false, "phones carry no filter row: search reaches every classification");
          assert.ok(result.status.bottom <= result.sidebar.top + .1, "the readout rides above the sheet");
          assert.equal(result.minimapShown, false, "phones leave the scene uncovered");
          assert.equal(result.minimapSettingShown, false, "phones offer no minimap setting");
          assert.equal(result.sourcesShown, true, "phones carry the shared Sources card in the sheet");
          assert.equal(result.githubShown, false, "phones show no GitHub link");
          // For now phones show no app actions; the search field takes the rest of the header row.
          assert.ok(result.settings.width === 0 && result.facilityAction.width === 0, "phones show no Settings or Machines action");
          assert.ok(result.search.right >= result.header.right - 24, "the search field reaches the end of the header row");
          assert.ok(result.brand.right <= result.search.left, "the wordmark heads the row");
        } else {
          near(result.sidebar.x, 12, "panel left margin");
          near(result.sidebarFrame.width, 340, "independent panel width");
          near(result.sidebarFrame.right, result.sidebar.right, "panel has no outer border");
          near(result.card.top, result.sidebar.top, "content starts without an empty search row");
          assert.ok(result.sidebar.top >= result.header.bottom, "the panel starts below the header");
          assert.ok(result.sidebar.bottom <= config.height, "the panel stays inside the window");
          assert.equal(result.minimapShown, false, "the minimap setting starts off");
          assert.equal(result.minimapMounted, false, "the minimap is not built until it is asked for");
          assert.equal(result.sourcesShown, true, "wider layouts print the source credits");
          assert.equal(result.githubShown, true, "wider layouts show the GitHub link");
          assert.ok(result.categories.left >= result.search.right,
            "filters follow the search field across the header");
          assert.ok(config.height - result.status.bottom < 2, "the readout sits on the bottom strip");
          assert.ok(result.status.right <= config.width + .1, "the readout stays on screen");
        }
      };
      check(await measure());
      if (!sheetLayout) {
        // Settings switches the minimap on, draws the current view, and off again.
        const minimapSetting = page.locator('.planet-settings label').filter({ hasText: 'Minimap' });
        await page.locator('.planet-settings-action').click();
        await minimapSetting.click();
        await page.waitForFunction(() => Number(document.querySelector<HTMLElement>('.space-minimap')?.dataset.visibleBodies) > 0);
        assert.equal((await measure()).minimapShown, true, `${config.name}: the setting shows the minimap`);
        await page.screenshot({ path: `${output}/${config.name}-minimap.png` });
        await minimapSetting.click();
        const off = await measure();
        assert.equal(off.minimapShown, false, `${config.name}: the setting hides the minimap again`);
        assert.equal(off.minimapMounted, true, `${config.name}: a hidden minimap keeps its retained markers`);
        await page.locator('.planet-settings-action').click();
      }
      assert.equal(await page.locator('.planet-sidebar-frame .explorer-shell-header').count(), 0, 'header is outside the panel');
      const camera = required(await page.locator('.planet-stage > .polycss-camera').elementHandle());
      const sheetTop = () => page.evaluate(() => Math.round(document.querySelector('.planet-sidebar')!.getBoundingClientRect().top));
      // A stop is reached once the sheet rests at its declared height, not when
      // the state flips: the transform is still animating then.
      const settle = (expected: 'peek' | 'half' | 'full') => page.waitForFunction((state) => {
          const element = document.querySelector('.planet-sidebar');
          if (!element || document.body.dataset.sheet !== state) return false;
          const style = getComputedStyle(element);
          const visible = state === 'peek' ? parseFloat(style.getPropertyValue('--sheet-peek'))
            : state === 'half' ? parseFloat(style.getPropertyValue('--sheet-half'))
            : element.getBoundingClientRect().height;
          return Math.abs(element.getBoundingClientRect().top - (innerHeight - visible)) < 1.5;
      }, expected);
      if (sheetLayout) {
        // The native grabber opens the sheet; arrow keys add intermediate stops. Every stop
        // keeps the scene mounted behind it.
        const grabber = page.locator('.planet-sheet-handle');
        await settle('peek');
        const peekTop = await sheetTop();
        await grabber.press('ArrowUp');
        await settle('half');
        const halfTop = await sheetTop();
        assert.ok(halfTop < peekTop, `${config.name}: half opens further than peek`);
        await grabber.press('ArrowUp');
        await settle('full');
        const fullTop = await sheetTop();
        assert.ok(fullTop < halfTop, `${config.name}: full opens further than half`);
        assert.ok(fullTop >= 0 && fullTop <= peekTop, `${config.name}: the open sheet stays on screen`);
        assert.equal(await page.evaluate(() => {
          const header = document.querySelector('.explorer-shell-header')!.getBoundingClientRect();
          return document.querySelector('.planet-sidebar')!.getBoundingClientRect().top >= header.top;
        }), true, `${config.name}: the search row stays reachable above the open sheet`);
        await page.screenshot({ path: `${output}/${config.name}-sheet.png` });
        await grabber.click();
        await settle('peek');
        assert.ok(Math.abs(await sheetTop() - peekTop) <= 2, `${config.name}: the grabber returns the sheet to peek`);
        assert.equal(await camera.evaluate(node => node === document.querySelector('.planet-stage > .polycss-camera')), true,
          `${config.name}: moving the sheet retains the camera`);
      }
      const search = page.locator('.planet-sidebar-search');
      const initialQuery = await search.inputValue();
      assert.equal(await page.locator('.planet-sidebar-search-clear').isVisible(), initialQuery.length > 0,
        `${config.name}: clear appears only with a query`);
      await search.fill('Neptune');
      assert.equal(await page.locator('.planet-object-browser').isVisible(), true);
      assert.equal(await page.locator('.planet-object-browser').evaluate(node => node.closest('.planet-sidebar') !== null), true,
        `${config.name}: search results belong to the sidebar`);
      assert.equal(await page.locator('.planet-information-panel').isVisible(), false,
        `${config.name}: search results replace the selected object card`);
      assert.equal(await page.locator('.planet-sidebar-search-clear').isVisible(), true,
        `${config.name}: a query offers to clear itself`);
      if (sheetLayout) {
        assert.equal(await page.evaluate(() => document.body.dataset.sheet), 'full',
          `${config.name}: searching opens the sheet for its results`);
      }
      await page.locator('.planet-sidebar-search-clear').click();
      assert.equal(await search.inputValue(), '');
      assert.equal(await page.locator('.planet-information-panel').isVisible(), true,
        `${config.name}: clearing the search restores the selected card`);
      const breadcrumbs = page.locator('.planet-information-panel .planet-breadcrumbs').first();
      assert.deepEqual((await breadcrumbs.locator('li').allTextContents()).map(text => text.replace(/[»\s]+/gu, ' ').trim()),
        ['Local Group', 'Milky Way', 'Solar System'], `${config.name}: the card names its three closest ancestors`);
      assert.equal((await page.locator('.planet-information-panel .planet-title').first().textContent())?.trim(), 'Jupiter');
      await search.fill('Neptune');
      await search.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement?.closest('.planet-object-browser') !== null), true,
        `${config.name}: the arrow key moves into the results`);
      await search.press('Escape');
      if (sheetLayout) {
        await settle('peek');
        assert.equal(await page.evaluate(() => document.body.dataset.sheet), 'peek',
          `${config.name}: leaving search returns the sheet over the scene`);
      }
      assert.equal(await camera.evaluate(node => node === document.querySelector('.planet-stage > .polycss-camera')), true);
      await camera.dispose();
      const containment = await page.evaluate((sheetLayout) => {
        const test = window.__cssearthTest;
        const viewport = test.element('.planet-viewport');
        const bounds = viewport.getBoundingClientRect();
        const input = test.element('.planet-input-surface');
        const sidebar = test.element('.planet-sidebar');
        const sidebarBounds = sidebar.getBoundingClientRect();
        const sceneTarget = document.elementFromPoint(bounds.right - 8, bounds.top + 8);
        const sidebarTarget = document.elementFromPoint(sidebarBounds.left + 30, sidebarBounds.top + 20);
        const result:{sceneInput:boolean;sidebarInput:boolean;probeVisibleInside?:boolean;probeClippedOutside?:boolean;searchAboveScene?:boolean;probeHit?:string} = {
          sceneInput: input === sceneTarget, sidebarInput: sidebar.contains(sidebarTarget) };
        if (bounds.top === 0) {
          // Even an extreme-Z scene descendant must remain below the shell,
          // while the exposed scene stays interactive.
          const probe = document.createElement('div');
          probe.style.cssText = 'position:absolute;inset:0;pointer-events:auto;transform:translateZ(1000000px);z-index:2147483647';
          test.element('.planet-scene-overlays').append(probe);
          try {
            // The exposed scene lies beside a docked panel, and above a sheet.
            const headerBounds = test.element('.explorer-shell-header').getBoundingClientRect();
            const [probeX, probeY] = sheetLayout
              ? [sidebarBounds.left + sidebarBounds.width / 2, (headerBounds.bottom + sidebarBounds.top) / 2]
              : [sidebarBounds.right + 20, sidebarBounds.top + 20];
            const hit = document.elementFromPoint(probeX, probeY);
            result.probeVisibleInside = hit === probe;
            result.probeHit = hit === probe ? 'probe' : `${hit?.tagName ?? 'none'}.${String(hit?.className ?? '')} at ${Math.round(probeX)},${Math.round(probeY)}`;
            result.probeClippedOutside = sidebar.contains(document.elementFromPoint(sidebarBounds.left + 30, sidebarBounds.top + 20));
            const search = test.element('.planet-sidebar-search');
            const searchBounds = search.getBoundingClientRect();
            result.searchAboveScene = test.required(search.closest('.planet-sidebar-search-card'),'search card').contains(document.elementFromPoint(searchBounds.left + 20, searchBounds.top + 5));
          } finally { probe.remove(); }
        }
        return result;
      }, sheetLayout);
      assert.equal(containment.sceneInput, true, `${config.name}: scene input owns its region`);
      assert.equal(containment.sidebarInput, true, `${config.name}: sidebar input stays in the sidebar`);
      if (containment.probeVisibleInside !== undefined) {
        assert.equal(containment.probeVisibleInside, true, `${config.name}: the containment probe really renders, hit ${containment.probeHit}`);
        assert.equal(containment.probeClippedOutside, true, `${config.name}: high-Z scene descendants stay behind the panel`);
        assert.equal(containment.searchAboveScene, true, `${config.name}: search stays above the scene`);
      }
    }
    console.log(`${config.name}: ${captureBefore ? "baseline captured" : "layout and alignment passed"}`);
    await page.close();
  }
} finally {
  await browser.close();
}
