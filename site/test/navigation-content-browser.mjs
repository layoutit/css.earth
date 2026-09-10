import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto(`${origin}/mercury/`);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  const proof = await page.evaluate(async () => {
    const { createNavigationContent } = await import('/site/navigation-content.mts');
    const { mountPlanetShell } = await import('/site/planet-shell-client.mts');
    const headMetadata = doc => ({
      title: doc.title,
      tags: [...doc.head.querySelectorAll('link[rel="canonical"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')]
        .map(node => node.outerHTML).sort(),
    });
    const initialMetadata = headMetadata(document);
    const expectedMetadata = headMetadata(new DOMParser().parseFromString(await fetch('/venus/').then(response => response.text()), 'text/html'));
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
    const probeTagBrowsing = () => [...document.querySelectorAll('[data-object-query]')].map(tag => {
      tag.click();
      const search = document.querySelector('.planet-sidebar-search');
      const result = {
        expected: tag.dataset.objectQuery,
        query: search.value,
        open: !document.querySelector('.planet-object-browser').hidden,
        informationHidden: document.querySelector('.planet-information-panel').hidden,
      };
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return result;
    });
    shell.setObject(content);
    const first = {
      metadata: headMetadata(document),
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
      tagBrowsing: probeTagBrowsing(),
    };
    const reverse = await transport.load({ id: 'mercury', name: 'Mercury', route: '/mercury/' }, { signal: new AbortController().signal });
    shell.setObject(reverse);
    const second = {
      metadata: headMetadata(document),
      identities: selectors.map((selector, index) => document.querySelector(selector) === retained[index]),
      selectedSearch: document.querySelector('.planet-sidebar-search').value,
      surfaceStylesRetained: surfaceStyles.every(style => style.isConnected),
      selectedSurface: getComputedStyle(leaf).backgroundImage,
      tagBrowsing: probeTagBrowsing(),
    };
    surfaceProbe.remove();
    shell.destroy();
    return { first, second, initialMetadata, expectedMetadata };
  });
  assert.deepEqual(proof.first.metadata, proof.expectedMetadata, 'Navigation must copy the destination title, canonical and social metadata.');
  assert.deepEqual(proof.second.metadata, proof.initialMetadata, 'Returning must restore the original metadata.');
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
  for (const transition of [proof.first, proof.second]) {
    assert.equal(transition.tagBrowsing.length, 2);
    for (const tag of transition.tagBrowsing) {
      assert.equal(tag.query, tag.expected, 'System and classification labels must filter after content replacement.');
      assert.equal(tag.open, true);
      assert.equal(tag.informationHidden, true);
    }
  }
  assert.ok(proof.second.identities.every(Boolean));
  assert.equal(proof.second.selectedSearch, 'Mercury');
  assert.equal(proof.second.surfaceStylesRetained, true);
  assert.equal(proof.second.selectedSurface, proof.first.surfaceBefore,
    'Returning to Mercury must restore its image using the retained shared stylesheet.');
  console.log(JSON.stringify({ status: 'passed', checks: 19, ...proof }));
} finally { await browser.close(); }
