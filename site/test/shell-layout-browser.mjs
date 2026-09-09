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
  ".explorer-rail", ".explorer-rail-explore", ".planet-sidebar", ".planet-sidebar-search",
  ".planet-information-panel", ".planet-information-panel .planet-title", ".planet-information-panel .planet-introduction",
  ".planet-panel-summary", ".planet-lens-icon", ".planet-stage", ".planet-viewport",
];

try {
  for (const config of cases) {
    const page = await browser.newPage({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: config.density,
    });
    await page.goto(`${baseUrl}/jupiter/`);
    await page.waitForFunction(() => document.querySelector(".planet-stage")?.getAttribute("aria-busy") === "false");
    const geometry = await page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => {
      const node = document.querySelector(selector);
      const { x, y, width, height } = node.getBoundingClientRect();
      return [selector, { x, y, width, height }];
    })), selectors);
    const beforePath = `${output}/${config.name}-before.json`;
    if (captureBefore) {
      await writeFile(beforePath, JSON.stringify(geometry, null, 2));
    } else if (compareBaseline) {
      const before = JSON.parse(await readFile(beforePath, "utf8"));
      for (const selector of selectors) {
        for (const dimension of ["x", "y", "width", "height"]) {
          assert.ok(Math.abs(geometry[selector][dimension] - before[selector][dimension]) < 0.1,
            `${config.name} ${selector} ${dimension}: ${before[selector][dimension]} -> ${geometry[selector][dimension]}`);
        }
      }
    }
    await page.screenshot({ path: `${output}/${config.name}-${captureBefore ? "before" : "after"}.png` });
    if (!captureBefore) {
      const measure = () => page.evaluate(() => {
        const bodyStyle = getComputedStyle(document.body);
        const box = (selector) => document.querySelector(selector).getBoundingClientRect().toJSON();
        const sidebar = box(".planet-sidebar");
        return {
          header: box(".explorer-shell-header"), stage: box(".planet-stage"), sidebar,
          railHidden: document.querySelector('.explorer-rail').getClientRects().length === 0,
          searchInHeader: document.querySelector('.planet-sidebar-search').closest('.explorer-shell-header') !== null,
          searchInToolbar: document.querySelector('.planet-sidebar-search').closest('.planet-search-toolbar') !== null,
          sidebarFrame: box(".planet-sidebar-frame"),
          viewport: box(".planet-viewport"), input: box(".planet-input-surface"),
          overlays: box(".planet-scene-overlays"), status: box(".planet-view-readout"),
          sourcesHidden: document.querySelector(".planet-attribution-footer").getClientRects().length === 0,
          isolated: getComputedStyle(document.querySelector('.planet-viewport')).isolation === 'isolate',
          sceneParent: document.querySelector('.planet-stage').parentElement.className,
          uiInScene: document.querySelector('.planet-stage').querySelectorAll('.planet-sidebar, .explorer-shell-header, .planet-view-readout, .space-minimap').length,
          wordmarkSlot: box(".explorer-shell-wordmark"),
          wordmark: box(".maps-brand-button"),
          versionCount: document.querySelectorAll(".planet-wordmark-version").length,
          search: box(".planet-sidebar-search-card"), toolbar: box(".planet-search-toolbar"),
          github: box(".planet-github-link"), collapse: box(".planet-sidebar-collapse"), reportIssue: box(".planet-report-issue-link"),
          projectLinks: box(".planet-project-links"), explorerActions: box(".explorer-rail"),
          codepenCount: document.querySelectorAll(".planet-codepen-link").length,
          categoryButtons: [...document.querySelectorAll(".planet-search-category")].map(node => node.getBoundingClientRect().toJSON()),
          card: box(".planet-information-panel"),
          inset: parseFloat(bodyStyle.getPropertyValue("--explorer-content-inset")),
          titleInset: box(".planet-information-panel .planet-title").left - sidebar.left,
          mountedLayers: document.querySelectorAll(".planet-stage > .polycss-camera").length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      const check = (result, { inset = 20 } = {}) => {
        const mobile = config.width <= 820 || config.height >= config.width;
        const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.08,
          `${config.name}: ${label}: ${actual} != ${expected}`);
        near(result.header.x, 16, "header left inset");
        near(result.header.y, 8, "header top inset");
        near(result.header.height, mobile ? 96 : 44, "header height");
        near(result.search.y, result.header.y, "search and wordmark share the header row");
        near(result.search.height, 44, "search field height");
        near(result.search.right, mobile ? result.sidebar.right : result.sidebarFrame.right, "search ends at the sidebar wrapper edge");
        assert.equal(result.railHidden, false, `${config.name}: About and Settings are restored`);
        assert.equal(result.searchInHeader, true, `${config.name}: search belongs to the header`);
        assert.deepEqual(result.stage, result.viewport, `${config.name}: scene fills its own viewport`);
        assert.deepEqual(result.input, result.viewport, `${config.name}: input uses the rendered viewport`);
        assert.deepEqual(result.overlays, result.viewport, `${config.name}: overlays share the bounded viewport`);
        assert.equal(result.sceneParent, 'planet-viewport');
        assert.equal(result.isolated, true);
        assert.equal(result.uiInScene, 0, `${config.name}: UI stays outside the 3D scene`);
        near(result.stage.left, 0, "scene extends behind the floating sidebar");
        near(result.stage.width, config.width, "scene uses the full viewport width");
        near(result.wordmarkSlot.x, 16, "wordmark aligns with the panel edge");
        near(result.wordmarkSlot.y, 8, "wordmark top inset");
        near(result.wordmarkSlot.height, 44, "wordmark row height");
        assert.equal(result.searchInToolbar, false, "search is separate from the outside pill bar");
        near(result.search.left - result.wordmarkSlot.right, 24, "wordmark to search gap");
        assert.equal(result.codepenCount, 0, "CodePen is removed");
        near(result.github.left - result.reportIssue.right, 8, "Report issue sits before GitHub");
        near(result.github.height, 44, "GitHub pill height");
        near(result.projectLinks.right, config.width - 12, "right pill bar inset");
        assert.ok(result.projectLinks.left >= 12, "right pill bar stays on screen");
        near(result.explorerActions.left, result.toolbar.left, "About and Settings start the left toolbar");
        near(result.collapse.left - result.explorerActions.right, 8, "Collapse is last after Settings");
        near(result.github.top, result.viewport.top + 8, "GitHub pill follows the viewport top");
        assert.equal(result.categoryButtons.length, 0, "Category pills are removed");
        assert.ok(result.toolbar.right <= config.width, "pill bar stays on screen");
        if (mobile) {
          near(result.toolbar.left, result.header.left, "pill bar aligns below the wordmark");
          near(result.toolbar.top, result.search.bottom + 8, "toolbar actions occupy the second row");
        } else {
          assert.ok(result.toolbar.right + 8 <= result.projectLinks.left, "pill bar leaves room for the project links");
          near(result.header.width, result.sidebarFrame.width, "header matches the content panel width");
          near(result.toolbar.left - result.search.right, 8, "pills follow the independent header");
        }
        assert.equal(result.versionCount, 0);
        near(result.sidebar.x, 16, "sidebar left margin");
        if (!mobile) {
          near(result.sidebarFrame.width, 340, "independent panel width");
          near(result.sidebarFrame.right, result.sidebar.right, "panel has no outer border");
          near(result.card.top, result.sidebar.top, "content starts without an empty search row");
          near(result.titleInset, inset, "title inset");
          near(result.sidebarFrame.y, result.header.bottom + 12, "independent panel starts below the header");
          near(result.sidebarFrame.bottom, result.sidebar.bottom, "panel ends with its content");
          near(result.sidebar.y, result.header.bottom + 12, "scrolling content starts below the header");
          assert.ok(result.sidebar.bottom <= config.height - 34 + .1, "panel stays above the footer with space below");
          near(result.stage.top, 0, "scene uses the space from the hidden source strip");
          near(result.stage.bottom, config.height, "scene fills the window behind the status overlay");
          assert.equal(result.sourcesHidden, true, "source strip is hidden");
          near(result.status.left, 0, "status uses the viewport width");
        } else {
          assert.ok(result.stage.top >= result.header.bottom, `${config.name}: scene starts below the header`);
          assert.ok(result.stage.bottom <= result.sidebar.top + .1, `${config.name}: scene ends before the information panel`);
        }
        assert.equal(result.overflow, false, `${config.name}: no page overflow`);
        assert.equal(result.mountedLayers, 1, `${config.name}: exactly one camera remains mounted`);
      };
      check(await measure());
      assert.equal(await page.locator('.planet-sidebar-frame .explorer-shell-header').count(), 0, 'header is outside the panel');
      if (config.width > 820 && config.width > config.height) {
        assert.deepEqual(await page.locator('.planet-sidebar-frame').evaluate(node => {
          const style = getComputedStyle(node);
          return [style.borderRightWidth, style.borderRadius, style.overflow];
        }), ['0px', '0px', 'hidden']);
      }
      assert.equal(await page.locator('.planet-search-toolbar > :last-child').getAttribute('class'), 'planet-sidebar-collapse');
      assert.deepEqual(await page.locator('.planet-project-links').evaluate(node => {
        return [...node.querySelectorAll('button:not([hidden]), a')].map(action => action.getAttribute('title') || action.textContent.trim().split(' (')[0]);
      }), ['Report issue', 'GitHub']);
      const searchGeometry = await page.locator('.planet-sidebar-search-card').evaluate(node => {
        const input = node.querySelector('.planet-sidebar-search');
        const icon = node.querySelector('.planet-sidebar-view-all');
        return { iconInset: icon.getBoundingClientRect().left - input.getBoundingClientRect().left,
          textInset: getComputedStyle(input).paddingLeft };
      });
      assert.deepEqual(searchGeometry, { iconInset: 4, textInset: '41px' });
      assert.equal(await page.locator('.planet-information-panel').evaluate(node => {
        return node.querySelector('.planet-breadcrumbs').getBoundingClientRect().top - node.getBoundingClientRect().top;
      }), 16, 'breadcrumbs have 16px top padding');
      const collapseBox = await page.locator('.planet-sidebar-collapse').boundingBox();
      assert.equal(collapseBox.width, 44);
      assert.equal(collapseBox.height, 44);
      const camera = await page.locator('.planet-stage > .polycss-camera').elementHandle();
      for (const name of ['About', 'Settings']) {
        const action = page.getByRole('button', { name, exact: true });
        assert.equal((await action.boundingBox()).height, 44);
      }
      const search = page.locator('.planet-sidebar-search');
      const searchBox = await search.boundingBox();
      const initialQuery = await search.inputValue();
      await search.fill('');
      assert.equal(await search.inputValue(), '');
      assert.equal(await page.locator('.planet-information-panel').isVisible(), true,
        `${config.name}: clearing search retains the selected object card`);
      assert.equal(await page.locator('.planet-object-browser').isVisible(), false);
      await search.fill('Neptune');
      assert.equal(await page.locator('.planet-object-browser').isVisible(), true);
      assert.equal(await page.locator('.planet-information-panel').isVisible(), false);
      await search.press('Escape');
      const collapse = () => page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
      const expectExpanded = async () => {
        assert.equal(await page.locator('.planet-sidebar').evaluate(node => node.inert), false);
        assert.equal(await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).getAttribute('aria-expanded'), 'true');
        assert.equal(await camera.evaluate(node => node === document.querySelector('.planet-stage > .polycss-camera')), true,
          `${config.name}: toggling retains the camera`);
      };
      await collapse();
      assert.equal(await page.locator('.planet-sidebar').evaluate(node => node.inert), true);
      assert.equal(await page.getByRole('button', { name: 'Expand sidebar', exact: true }).getAttribute('aria-expanded'), 'false');
      assert.deepEqual(await search.boundingBox(), searchBox, `${config.name}: search stays in place`);
      assert.equal(await search.inputValue(), initialQuery, `${config.name}: collapse preserves the search`);
      const collapsed = await measure();
      assert.equal(collapsed.viewport.left, 0);
      assert.equal(collapsed.viewport.width, config.width);
      assert.deepEqual(collapsed.input, collapsed.viewport);
      assert.equal(await page.evaluate(() => document.elementFromPoint(120, 240)?.className), 'planet-input-surface',
        `${config.name}: the collapsed sidebar does not intercept scene input`);
      await page.screenshot({ path: `${output}/${config.name}-collapsed.png` });
      await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
      await expectExpanded();
      check(await measure());
      for (const [name, selector] of [['About', '.explorer-about-panel'], ['Settings', '.explorer-settings-panel']]) {
        await collapse();
        await page.getByRole('button', { name, exact: true }).click();
        await expectExpanded();
        assert.equal(await page.locator(selector).isVisible(), true);
        assert.equal(await search.isVisible(), true);
        if (config.width > 820 && config.width > config.height) {
          const sidebarBox = await page.locator('.planet-sidebar').boundingBox();
          const panelBox = await page.locator(selector).boundingBox();
          assert.ok(sidebarBox.height < config.height - 64, 'short panels do not fill the screen');
          assert.ok(sidebarBox.height <= panelBox.height + 13, 'sidebar follows the selected panel content');
        }
        await page.keyboard.press('Escape');
      }
      await collapse();
      await search.fill('Neptune');
      await expectExpanded();
      assert.equal(await page.locator('.planet-object-browser').isVisible(), true);
      await search.press('Escape');
      await collapse();
      await page.getByRole('button', { name: 'Planets', exact: true }).click();
      await expectExpanded();
      assert.equal(await search.inputValue(), 'Planets');
      await search.press('Escape');
      const breadcrumbs = page.locator('.planet-information-panel .planet-breadcrumbs');
      assert.deepEqual(await breadcrumbs.locator('li').allTextContents(), ['Milky Way', 'Solar System', 'Jupiter']);
      assert.equal(await breadcrumbs.locator('[aria-current="page"]').textContent(), 'Jupiter');
      await breadcrumbs.getByRole('button', { name: 'Milky Way', exact: true }).click();
      assert.equal(await page.locator('[data-galactic-overview]').isVisible(), true);
      await page.getByRole('link', { name: 'Browse Solar System', exact: true }).click();
      assert.equal(await page.locator('[data-solar-system-results]').isVisible(), true);
      await search.press('Escape');
      // Search-result keyboard navigation skips breadcrumb ancestors.
      await search.fill('Neptune');
      await search.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('planet-object-link')), true);
      await search.press('Escape');
      assert.equal(await camera.evaluate(node => node === document.querySelector('.planet-stage > .polycss-camera')), true);
      await camera.dispose();
      const containment = await page.evaluate(() => {
        const viewport = document.querySelector('.planet-viewport');
        const bounds = viewport.getBoundingClientRect();
        const input = document.querySelector('.planet-input-surface');
        const sidebar = document.querySelector('.planet-sidebar');
        const sidebarBounds = sidebar.getBoundingClientRect();
        const sceneTarget = document.elementFromPoint(bounds.right - 8, bounds.top + 8);
        const sidebarTarget = document.elementFromPoint(sidebarBounds.left + 30, sidebarBounds.top + 20);
        const result = { sceneInput: input === sceneTarget, sidebarInput: sidebar.contains(sidebarTarget) };
        if (bounds.top === 0) {
          // Even an extreme-Z scene descendant must remain below the entire
          // floating panel, while the exposed scene stays interactive.
          const probe = document.createElement('div');
          probe.style.cssText = 'position:absolute;inset:0;pointer-events:auto;transform:translateZ(1000000px);z-index:2147483647';
          document.querySelector('.planet-scene-overlays').append(probe);
          try {
            result.probeVisibleInside = document.elementFromPoint(sidebarBounds.right + 20, sidebarBounds.top + 20) === probe;
            result.probeClippedOutside = sidebar.contains(document.elementFromPoint(sidebarBounds.left + 30, sidebarBounds.top + 20));
            result.leftMarginOpen = document.elementFromPoint(5, sidebarBounds.top + 20) === probe;
            const search = document.querySelector('.planet-sidebar-search');
            const searchBounds = search.getBoundingClientRect();
            result.searchAboveScene = search.closest('.planet-sidebar-search-card').contains(document.elementFromPoint(searchBounds.left + 20, searchBounds.top + 20));
          } finally { probe.remove(); }
        }
        return result;
      });
      assert.equal(containment.sceneInput, true, `${config.name}: scene input owns its region`);
      assert.equal(containment.sidebarInput, true, `${config.name}: sidebar input stays in the sidebar`);
      if (containment.probeVisibleInside !== undefined) {
        assert.equal(containment.probeVisibleInside, true, `${config.name}: the containment probe really renders`);
        assert.equal(containment.probeClippedOutside, true, `${config.name}: high-Z scene descendants stay behind the sidebar`);
        assert.equal(containment.leftMarginOpen, true, `${config.name}: the 16px left margin belongs to the scene`);
        assert.equal(containment.searchAboveScene, true, `${config.name}: search stays above the scene`);
      }
      if (config.name === "desktop") {
        const style = await page.locator("body").getAttribute("style");
        try {
          for (const settings of [{ inset: 12 }, { inset: 24 }]) {
            await page.evaluate(({ inset }) => {
              document.body.style.setProperty("--explorer-content-inset", `${inset}px`);
            }, settings);
            check(await measure(), settings);
          }
        } finally {
          await page.evaluate((style) => {
            if (style === null) document.body.removeAttribute("style");
            else document.body.setAttribute("style", style);
          }, style);
        }
      }
    }
    console.log(`${config.name}: ${captureBefore ? "baseline captured" : "layout and alignment passed"}`);
    await page.close();
  }
} finally {
  await browser.close();
}
