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
    const surfaceStyles = sharedStyles.filter(style => style.dataset.viteDevId.endsWith('/src/renderers/css/styles/planet-surfaces.css'));
    const camera = document.querySelector('.polycss-camera');
    const leaf = document.querySelector('.mercury-body > s:not(.mercury-polar)');
    const surfaceBefore = getComputedStyle(leaf).backgroundImage;
    const before = getComputedStyle(camera).cssText + getComputedStyle(camera).perspective + getComputedStyle(camera).width;
    const controller = new AbortController();
    const transport = createNavigationContent({ documentTarget: document, windowTarget: window });
    const content = await transport.load({ id: 'venus', name: 'Venus', route: '/venus/' }, { signal: controller.signal });
    const afterPreparation = getComputedStyle(camera).cssText + getComputedStyle(camera).perspective + getComputedStyle(camera).width;
    const surfaceAfterPreparation = getComputedStyle(leaf).backgroundImage;
    window.dispatchEvent(new Event('pagehide'));
    // pagehide unmounts the renderer. Keep its measured leaf as a CSS probe;
    // this content-only test does not mount the destination renderer.
    const surfaceProbe = document.createElement('div');
    surfaceProbe.className = 'polycss-scene';
    surfaceProbe.setAttribute('aria-hidden', 'true');
    leaf.style.backgroundImage = surfaceBefore;
    surfaceProbe.append(leaf);
    document.querySelector('.planet-stage').append(surfaceProbe);
    const shell = mountPlanetShell({ objectId: 'mercury', documentTarget: document, windowTarget: window });
    shell.setObject(content);
    const first = {
      sourceUnchangedDuringPreparation: before === afterPreparation,
      surfaceBefore,
      surfaceAfterPreparation,
      identities: selectors.map((selector, index) => document.querySelector(selector) === retained[index]),
      sharedStylesRetained: sharedStyles.every(style => style.isConnected),
      surfaceStyleCount: surfaceStyles.length,
      surfaceStylesRetained: surfaceStyles.every(style => style.isConnected),
      selectedSurface: getComputedStyle(leaf).backgroundImage,
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
      surfaceStylesRetained: surfaceStyles.every(style => style.isConnected),
      selectedSurface: getComputedStyle(leaf).backgroundImage,
    };
    surfaceProbe.remove();
    shell.destroy();
    return { first, second };
  });
  assert.equal(proof.first.sourceUnchangedDuringPreparation, true);
  assert.match(proof.first.surfaceBefore, /\/scenes\/mercury\//);
  assert.equal(proof.first.surfaceAfterPreparation, proof.first.surfaceBefore,
    'Preparing Venus must not apply its scoped surface styling to the retained Mercury scene.');
  assert.ok(proof.first.identities.every(Boolean));
  assert.equal(proof.first.sharedStylesRetained, true);
  assert.equal(proof.first.surfaceStyleCount, 1);
  assert.equal(proof.first.surfaceStylesRetained, true);
  assert.match(proof.first.selectedSurface, /\/scenes\/venus\/venus-clouds@2x\.webp/,
    'Committing Venus content must activate its scoped surface image.');
  assert.equal(proof.first.selectedSearch, 'Venus');
  assert.equal(proof.first.activeNavbar, 'venus');
  assert.equal(proof.first.activeBrowser, 'venus');
  assert.equal(proof.first.selectedTitle, 'Venus');
  assert.equal(proof.first.aboutLabelBound, true);
  assert.ok(proof.second.identities.every(Boolean));
  assert.equal(proof.second.selectedSearch, 'Mercury');
  assert.equal(proof.second.surfaceStylesRetained, true);
  assert.equal(proof.second.selectedSurface, proof.first.surfaceBefore,
    'Returning to Mercury must restore its image using the retained shared stylesheet.');
  console.log(JSON.stringify({ status: 'passed', checks: 17, ...proof }));
} finally { await browser.close(); }
