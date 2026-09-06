import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto(`${origin}/mercury/`);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  const proof = await page.evaluate(async () => {
    const { createNavigationContent } = await import('/site/navigation-content.mjs');
    const { mountPlanetShell } = await import('/site/planet-shell-client.mjs');
    const selectors = ['.planet-sidebar', '.planet-sidebar-search', '.planet-drawer-content', '.planet-input-surface'];
    const retained = selectors.map(selector => document.querySelector(selector));
    const sharedStyles = [...document.head.querySelectorAll('style[data-vite-dev-id]')]
      .filter(style => !style.dataset.viteDevId.includes('/src/planets/'));
    const camera = document.querySelector('.polycss-camera');
    const before = getComputedStyle(camera).cssText + getComputedStyle(camera).perspective + getComputedStyle(camera).width;
    const controller = new AbortController();
    const transport = createNavigationContent({ documentTarget: document, windowTarget: window });
    const content = await transport.load({ id: 'venus', name: 'Venus', route: '/venus/' }, { signal: controller.signal });
    const afterPreparation = getComputedStyle(camera).cssText + getComputedStyle(camera).perspective + getComputedStyle(camera).width;
    const targetStyleBefore = [...document.head.querySelectorAll('style[data-vite-dev-id]')]
      .some(style => style.dataset.viteDevId.endsWith('/venus/runtime/styles.css'));
    window.dispatchEvent(new Event('pagehide'));
    const shell = mountPlanetShell({ objectId: 'mercury', documentTarget: document, windowTarget: window });
    shell.setObject(content);
    const first = {
      sourceUnchangedDuringPreparation: before === afterPreparation,
      targetStyleBefore,
      identities: selectors.map((selector, index) => document.querySelector(selector) === retained[index]),
      sharedStylesRetained: sharedStyles.every(style => style.isConnected),
      objectStyles: [...document.head.querySelectorAll('style[data-vite-dev-id]')]
        .filter(style => /\/src\/planets\/[^/]+\/runtime\/styles.css$/.test(style.dataset.viteDevId)).map(style => style.dataset.viteDevId.split('/').at(-3)),
      selectedSearch: document.querySelector('.planet-sidebar-search').value,
      activeNavbar: document.querySelector('.scale-planet.active').dataset.planetId,
      activeBrowser: document.querySelector('.planet-object-link.is-active').dataset.objectId,
      selectedTitle: document.querySelector('.planet-title').getAttribute('aria-label'),
      aboutLabelBound: Boolean(document.getElementById(document.querySelector('.explorer-about-panel').getAttribute('aria-labelledby'))),
    };
    const reverse = await transport.load({ id: 'mercury', name: 'Mercury', route: '/mercury/' }, { signal: new AbortController().signal });
    shell.setObject(reverse);
    const second = {
      identities: selectors.map((selector, index) => document.querySelector(selector) === retained[index]),
      selectedSearch: document.querySelector('.planet-sidebar-search').value,
      objectStyles: [...document.head.querySelectorAll('style[data-vite-dev-id]')]
        .filter(style => /\/src\/planets\/[^/]+\/runtime\/styles.css$/.test(style.dataset.viteDevId)).map(style => style.dataset.viteDevId.split('/').at(-3)),
    };
    shell.destroy();
    return { first, second };
  });
  assert.equal(proof.first.sourceUnchangedDuringPreparation, true);
  assert.equal(proof.first.targetStyleBefore, false);
  assert.ok(proof.first.identities.every(Boolean));
  assert.equal(proof.first.sharedStylesRetained, true);
  assert.deepEqual(proof.first.objectStyles, ['venus']);
  assert.equal(proof.first.selectedSearch, 'Venus');
  assert.equal(proof.first.activeNavbar, 'venus');
  assert.equal(proof.first.activeBrowser, 'venus');
  assert.equal(proof.first.selectedTitle, 'Venus');
  assert.equal(proof.first.aboutLabelBound, true);
  assert.ok(proof.second.identities.every(Boolean));
  assert.equal(proof.second.selectedSearch, 'Mercury');
  assert.deepEqual(proof.second.objectStyles, ['mercury']);
  console.log(JSON.stringify({ status: 'passed', checks: 13, ...proof }));
} finally { await browser.close(); }
