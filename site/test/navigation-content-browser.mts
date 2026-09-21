import { createTestPage } from './browser-observations.mts';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.CSSEARTH_TEST_ORIGIN ?? 'http://127.0.0.1:4210';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await createTestPage(browser, { viewport: { width: 1100, height: 800 } });
  await page.goto(`${origin}/mercury/`);
  await page.waitForFunction(() => window.__cssEarth?.ready === true);
  const proof = await page.evaluate(async () => {
    const { createNavigationContent } = await import('/site/navigation-content.mts');
    const { mountPlanetShell } = await import('/site/planet-shell-client.mts');
    const { SCENE_OBJECTS } = await import('/site/objects.mts');
    const object = (id: string) => window.__cssearthTest.required(SCENE_OBJECTS.find(value => value.id === id), `registry object ${id}`);
    const headMetadata = (doc: Document) => ({
      title: doc.title,
      tags: [...doc.head.querySelectorAll('link[rel="canonical"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')]
        .map(node => node.outerHTML).sort(),
    });
    const initialMetadata = headMetadata(document);
    const { navigationFragments } = await import('/site/navigation-fragments.mts');
    if (document.querySelector('template[data-object-card]')) throw new Error('Route ships a resident card bank');
    // Count requests at the page fetch the shared fragment cache calls.
    let fragmentRequests = 0;
    const nativeFetch = window.fetch;
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/navigation/venus/') fragmentRequests++;
      return nativeFetch.call(window, input, init);
    };
    navigationFragments(window).prefetch('venus');
    const fragment = await navigationFragments(window).get('venus');
    try {
      if (fragment.document.querySelector('template[data-object-card], [data-system-results], .planet-object-browser')) {
        throw new Error('Fragment repeats retained cards or object browser');
      }
    } finally { fragment.release(); }
    const expectedMetadata = headMetadata(new DOMParser().parseFromString(await fetch('/venus/').then(response => response.text()), 'text/html'));
    const selectors = ['.planet-sidebar', '.planet-sidebar-search', '.planet-object-browser', '.planet-drawer-content', '.planet-input-surface'];
    const retained = selectors.map(selector => document.querySelector(selector));
    const sharedStyles = [...document.head.querySelectorAll('style[data-vite-dev-id]')]
      .filter(style => !window.__cssearthTest.required(window.__cssearthTest.htmlElement(style).dataset.viteDevId, 'Vite stylesheet id').includes('/src/objects/'));
    const surfaceStyles = [...document.querySelectorAll('style[data-object-style="src/renderers/css/styles/planet-surfaces.css"]')];
    const camera = document.querySelector('.polycss-camera');
    const leaf = window.__cssearthTest.element('.mercury-body > s:not(.mercury-polar)');
    const surfaceBefore = getComputedStyle(window.__cssearthTest.required(leaf, 'computed style element')).backgroundImage;
    const before = getComputedStyle(window.__cssearthTest.required(camera, 'computed style element')).cssText + getComputedStyle(window.__cssearthTest.required(camera, 'computed style element')).perspective + getComputedStyle(window.__cssearthTest.required(camera, 'computed style element')).width;
    const controller = new AbortController();
    const transport = createNavigationContent({ documentTarget: document, windowTarget: window });
    const content = await transport.load(object('venus'), { signal: controller.signal });
    window.fetch = nativeFetch;
    const afterPreparation = getComputedStyle(window.__cssearthTest.required(camera, 'computed style element')).cssText + getComputedStyle(window.__cssearthTest.required(camera, 'computed style element')).perspective + getComputedStyle(window.__cssearthTest.required(camera, 'computed style element')).width;
    const surfaceAfterPreparation = getComputedStyle(window.__cssearthTest.required(leaf, 'computed style element')).backgroundImage;
    window.dispatchEvent(new Event('pagehide'));
    // pagehide unmounts the renderer. Keep its measured leaf as a CSS probe;
    // this content-only test does not mount the destination renderer.
    const surfaceProbe = document.createElement('div');
    surfaceProbe.className = 'polycss-scene';
    surfaceProbe.setAttribute('aria-hidden', 'true');
    window.__cssearthTest.htmlElement(leaf).style.backgroundImage = surfaceBefore;
    surfaceProbe.append(leaf);
    window.__cssearthTest.element('.planet-stage').append(surfaceProbe);
    const shell = mountPlanetShell({ objectId: 'mercury', documentTarget: document, windowTarget: window });
    const breadcrumbs = () => [...document.querySelectorAll('.planet-information-panel .planet-breadcrumbs a')].map(a => a.getAttribute('href'));
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
      selectedSurface: getComputedStyle(window.__cssearthTest.required(leaf, 'computed style element')).backgroundImage,
      selectedSearch: window.__cssearthTest.input('.planet-sidebar-search').value,
      activeBrowser: window.__cssearthTest.html('.planet-object-link.is-active').dataset.objectId,
      browserId: window.__cssearthTest.html('.planet-object-browser').id,
      browserControl: window.__cssearthTest.input('.planet-sidebar-search').getAttribute('aria-controls'),
      selectedTitle: window.__cssearthTest.element('.planet-information-panel .planet-title').getAttribute('aria-label'),
      aboutLabelBound: Boolean(document.getElementById(window.__cssearthTest.required(window.__cssearthTest.element('.explorer-about-panel').getAttribute('aria-labelledby'), 'about label reference'))),
      breadcrumbs: breadcrumbs(),
      fragmentRequests,
      descriptor: JSON.parse(window.__cssearthTest.required(document.querySelector('script[data-prepared-descriptor]')?.textContent, 'prepared descriptor')).id,
    };
    const reverse = await transport.load(object('mercury'), { signal: new AbortController().signal });
    shell.setObject(reverse);
    const second = {
      metadata: headMetadata(document),
      identities: selectors.map((selector, index) => document.querySelector(selector) === retained[index]),
      selectedSearch: window.__cssearthTest.input('.planet-sidebar-search').value,
      surfaceStylesRetained: surfaceStyles.every(style => style.isConnected),
      selectedSurface: getComputedStyle(window.__cssearthTest.required(leaf, 'computed style element')).backgroundImage,
      breadcrumbs: breadcrumbs(),
      descriptor: JSON.parse(window.__cssearthTest.required(document.querySelector('script[data-prepared-descriptor]')?.textContent, 'prepared descriptor')).id,
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
  assert.equal(proof.first.selectedSearch, '', 'Selection closes browsing and clears the search query');
  assert.equal(proof.first.activeBrowser, 'venus');
  assert.equal(proof.first.browserId, 'venus-object-browser');
  assert.equal(proof.first.browserControl, proof.first.browserId);
  assert.equal(proof.first.selectedTitle, 'Venus');
  assert.equal(proof.first.aboutLabelBound, true);
  assert.equal(proof.first.fragmentRequests, 1, 'The destination load reuses the intent-fetched fragment');
  assert.equal(proof.first.descriptor, 'venus');
  for (const transition of [proof.first, proof.second]) {
    assert.ok(transition.breadcrumbs.includes('/sun/?overview=milky-way'));
    assert.ok(transition.breadcrumbs.includes('/sun/?overview=system'));
  }
  assert.ok(proof.second.identities.every(Boolean));
  assert.equal(proof.second.selectedSearch, '');
  assert.equal(proof.second.descriptor, 'mercury');
  assert.equal(proof.second.surfaceStylesRetained, true);
  assert.equal(proof.second.selectedSurface, proof.first.surfaceBefore,
    'Returning to Mercury must restore its image using the retained shared stylesheet.');
  console.log(JSON.stringify({ status: 'passed', checks: 20, ...proof }));
} finally { await browser.close(); }
