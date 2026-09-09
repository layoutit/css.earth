// Playwright CLI run-code input. Open the built 67P route in a named session,
// optionally with a shared camera view, then pass this file with --filename.
async page => {
  const browser = page.context().browser();
  const origin = await page.evaluate(() => ({ hostname: location.hostname, pathname: location.pathname, href: location.href }));
  if (origin.hostname !== '127.0.0.1' || origin.pathname !== '/comet-67p/') throw new Error('Open the local built 67P viewer first.');
  const results = [];
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
    try {
      const p = await context.newPage(), errors = [], requests = [];
      p.on('pageerror', e => errors.push(String(e)));
      p.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
      p.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      p.on('request', r => requests.push(r.url()));
      await p.goto(origin.href, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      await p.evaluate(() => {
        const root = document.querySelector('.comet-67p-body');
        window.__osirisProof = { root, leaves: [...root.querySelectorAll(':scope > u')], mutations: [] };
        const probe = window.__osirisProof;
        probe.geometryProperties = ['transform', 'width', 'height', 'background-position', 'background-size',
          '--polycss-atlas-width', '--polycss-atlas-height'];
        probe.geometry = new Map(probe.leaves.map(n => [n, probe.geometryProperties.map(k => n.style.getPropertyValue(k))]));
        probe.observer = new MutationObserver(records => probe.mutations.push(...records));
        probe.observer.observe(root, { subtree: true, childList: true, attributes: true, attributeOldValue: true });
      });
      const prefix = `output/playwright/67p-osiris-product-dpr${dpr}`;
      const select = async id => {
        await p.locator(`button[name="lens"][value="${id}"]`).click();
        await p.waitForFunction(id => document.querySelector(`button[name="lens"][value="${id}"]`).getAttribute('aria-pressed') === 'true', id);
        await p.waitForLoadState('networkidle');
      };
      const digestAtlases = () => p.evaluate(async () => {
        const urls = [...new Set([...document.querySelectorAll('.comet-67p-body > u')].map(n =>
          getComputedStyle(n).backgroundImage.match(/^url\("?([^"\)]+)"?\)$/)?.[1]))];
        return Promise.all(urls.map(async url => {
          if (!url) throw new Error('Missing retained atlas URL.');
          const response = await fetch(url), bytes = await response.arrayBuffer();
          if (!response.ok) throw new Error('Atlas readback failed.');
          const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
          return { url, bytes: bytes.byteLength, sha256 };
        }));
      });
      await select('osiris'); await select('model'); await select('osiris');
      await p.screenshot({ path: `${prefix}-shadows.png` });
      const shadows = await digestAtlases();
      await p.getByRole('button', { name: 'Settings', exact: true }).click();
      await p.locator('label').filter({ hasText: 'Shadows' }).click();
      if (await p.locator('input[name="shadows"]').isChecked()) throw new Error('Shadows did not switch off.');
      await p.keyboard.press('Escape');
      await p.waitForLoadState('networkidle');
      await p.screenshot({ path: `${prefix}-flood.png` });
      const flood = await digestAtlases();
      if (!shadows.every(a => a.url.endsWith('comet-67p-osiris-shadow@2x.webp')) ||
          !flood.every(a => a.url.endsWith('comet-67p-osiris-surface@2x.webp'))) throw new Error('Incorrect prepared lighting bank.');
      const before = await p.locator('.polycss-scene').evaluate(n => getComputedStyle(n).transform);
      const requestOffset = requests.length;
      await p.mouse.move(830, 470); await p.mouse.down();
      await p.mouse.move(1120, 385, { steps: 60 }); await p.mouse.up();
      await p.waitForTimeout(800);
      const dragRequests = requests.slice(requestOffset);
      await p.screenshot({ path: `${prefix}-turned.png` });
      const after = await p.locator('.polycss-scene').evaluate(n => getComputedStyle(n).transform);
      const readback = await p.evaluate(() => {
        const probe = window.__osirisProof;
        probe.mutations.push(...probe.observer.takeRecords()); probe.observer.disconnect();
        const root = document.querySelector('.comet-67p-body'), leaves = [...root.querySelectorAll(':scope > u')];
        const geometryMatches = (node, style) => probe.geometryProperties.every((key, i) => style.getPropertyValue(key) === probe.geometry.get(node)[i]);
        const changedStyleProperties = new Set();
        const geometryMutations = probe.mutations.filter(r => {
          if (r.target.tagName !== 'U' || r.attributeName !== 'style') return false;
          const old = document.createElement('u').style; old.cssText = r.oldValue ?? '';
          for (const key of new Set([...old, ...r.target.style])) if (old.getPropertyValue(key) !== r.target.style.getPropertyValue(key)) changedStyleProperties.add(key);
          return !geometryMatches(r.target, old);
        }).length;
        const forbiddenStyles = leaves.some(n => { const s = getComputedStyle(n); return s.clipPath !== 'none' || s.filter !== 'none' ||
          s.maskImage !== 'none' || s.mixBlendMode !== 'normal' || /gradient\(/.test(s.backgroundImage); });
        return { devicePixelRatio, leaves: leaves.length, retained: root === probe.root &&
          leaves.length === probe.leaves.length && leaves.every((n, i) => n === probe.leaves[i]),
          leafMutations: probe.mutations.filter(r => r.target.tagName === 'U').length,
          geometryMutations, geometryRetained: leaves.every(n => geometryMatches(n, n.style)),
          changedStyleProperties: [...changedStyleProperties].sort(),
          treeMutations: probe.mutations.filter(r => r.type === 'childList').length,
          forbiddenElements: document.querySelectorAll('.comet-67p-body canvas,.comet-67p-body svg').length,
          forbiddenStyles, nativeBevel: CSS.supports('corner-top-left-shape', 'bevel'),
          production: !window['__comet-67p'], scenes: document.querySelectorAll('.polycss-scene').length,
          legend: document.querySelector('.planet-stage').dataset.lens ?? null };
      });
      const result = { browser: browser.version(), dpr, route: origin.href, finalUrl: p.url(), shadows, flood,
        beforeDrag: before, afterDrag: after, dragRequests, errors, ...readback };
      results.push(result);
      if (readback.leaves !== 1000 || !readback.retained || readback.geometryMutations || !readback.geometryRetained || readback.treeMutations ||
          readback.changedStyleProperties.some(key => key !== 'visibility') ||
          readback.forbiddenElements || readback.forbiddenStyles || !readback.nativeBevel || !readback.production ||
          readback.scenes !== 1 || errors.length || dragRequests.length || before === after) throw new Error(JSON.stringify(result));
    } finally { await context.close(); }
  }
  return results;
}
