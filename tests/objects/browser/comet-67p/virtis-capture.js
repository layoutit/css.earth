// Playwright CLI run-code input. Open the built local 67P route in a named
// Chrome session, then run this file. Captures and results stay local.
async page => {
  const origin = await page.evaluate(() => ({ hostname: location.hostname, pathname: location.pathname, href: location.href }));
  if (origin.hostname !== '127.0.0.1' || origin.pathname !== '/comet-67p/') throw new Error('Open the local built 67P viewer first.');
  const browser = page.context().browser(), results = [];
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: dpr });
    try {
      const p = await context.newPage(), errors = [], requests = [];
      p.on('pageerror', e => errors.push(String(e)));
      p.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
      p.on('request', r => requests.push(r.url()));
      await p.goto(origin.href, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => document.documentElement.dataset.ready === 'true');
      await p.evaluate(() => {
        const body = document.querySelector('.comet-67p-body'), nodes = [...body.querySelectorAll('*')], changes = [];
        const observer = new MutationObserver(records => changes.push(...records)); observer.observe(body, { subtree: true, childList: true });
        window.__virtisProof = { body, nodes, changes, observer };
      });
      await p.getByRole('button', { name: 'Settings', exact: true }).click();
      if (await p.locator('input[name="shadows"]').isChecked()) await p.locator('label').filter({ hasText: 'Shadows' }).click();
      await p.keyboard.press('Escape');
      const views = [];
      for (const id of ['albedo', 'slope', 'absorption', 'ice']) {
        await p.locator(`button[name="lens"][value="${id}"]`).click();
        await p.waitForFunction(id => document.querySelector(`button[name="lens"][value="${id}"]`).getAttribute('aria-pressed') === 'true', id);
        await p.waitForLoadState('networkidle');
        const image = p.locator(`img[src*="comet-67p-${id}-legend.webp"]`);
        if (await image.count() !== 1 || !await image.isVisible()) throw new Error(`Missing visible ${id} legend`);
        const panel = p.locator(`[data-lens-details="${id}"]`);
        const facts = await panel.locator('.planet-facts li').allTextContents();
        if ((facts.length < 2 || facts.length > 3) || !facts.some(text => text.includes('Aug–Sep 2014'))) throw new Error(`Missing ${id} factsheet`);
        const factLayout = await panel.locator('.planet-facts li').evaluateAll(rows => rows.map(row => {
          const value = row.querySelector('.planet-fact-value'), range = document.createRange();
          range.selectNodeContents(value);
          return { text: value.textContent, valueWidth: value.getBoundingClientRect().width,
            textWidth: range.getBoundingClientRect().width, height: value.getBoundingClientRect().height,
            leaderWidth: parseFloat(getComputedStyle(row, '::before').width) };
        }));
        if (factLayout.some(row => row.height <= 20 && Math.abs(row.valueWidth - row.textWidth) > 1)) throw new Error(`Unused value-column space in ${id} facts`);
        const dataset = await p.locator(`button[name="lens"][value="${id}"]`).innerText();
        if (!dataset.includes('VIRTIS') || /2014|Aug|Sep/.test(dataset)) throw new Error(`Verbose ${id} dataset row`);
        const legend = p.locator(`[data-lens-legend="${id}"]`);
        await legend.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const legendBounds = await legend.boundingBox();
        const footerTop = await p.locator('footer').evaluate(node => node.getBoundingClientRect().top);
        if (!legendBounds || legendBounds.y < 0 || legendBounds.y + legendBounds.height > footerTop) throw new Error(`Clipped ${id} legend`);
        const atlases = await p.evaluate(async () => {
          const urls = [...new Set([...document.querySelectorAll('.comet-67p-body > u')].map(n => getComputedStyle(n).backgroundImage.match(/^url\("?([^"\)]+)"?\)$/)?.[1]))];
          return Promise.all(urls.map(async url => {
            if (!url) throw new Error('Missing retained atlas'); const response = await fetch(url), bytes = await response.arrayBuffer();
            if (!response.ok) throw new Error('Atlas readback failed');
            return { url, bytes: bytes.byteLength, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('') };
          }));
        });
        if (!atlases.every(a => a.url.endsWith(`comet-67p-${id}-surface@2x.webp`))) throw new Error(`Wrong ${id} atlas bank`);
        const screenshot = `output/playwright/67p-virtis-dpr${dpr}-${id}.png`;
        await p.screenshot({ path: screenshot }); views.push({ id, screenshot, atlases, legendBounds, facts, factLayout, dataset });
      }
      await p.getByRole('button', { name: 'Settings', exact: true }).click();
      await p.locator('label').filter({ hasText: 'Shadows' }).click(); await p.keyboard.press('Escape');
      await p.waitForLoadState('networkidle');
      await p.screenshot({ path: `output/playwright/67p-virtis-dpr${dpr}-ice-shadows.png` });
      const readback = await p.evaluate(() => {
        const probe = window.__virtisProof; probe.changes.push(...probe.observer.takeRecords()); probe.observer.disconnect();
        const body = document.querySelector('.comet-67p-body'), nodes = [...body.querySelectorAll('*')];
        return { devicePixelRatio, leaves: body.querySelectorAll(':scope > u').length,
          retained: body === probe.body && nodes.length === probe.nodes.length && nodes.every((n, i) => n === probe.nodes[i]),
          treeMutations: probe.changes.length, sceneCount: document.querySelectorAll('.polycss-scene').length,
          forbiddenElements: body.querySelectorAll('canvas,svg').length,
          forbiddenStyles: nodes.some(n => { const s = getComputedStyle(n); return s.clipPath !== 'none' || s.filter !== 'none' || s.maskImage !== 'none' || s.mixBlendMode !== 'normal' || /gradient\(/.test(s.backgroundImage); }) };
      });
      const forbiddenRequests = requests.filter(url => /\.(?:tab|wrl)(?:\?|$)|source-index\.json/.test(url));
      const result = { browser: browser.version(), dpr, route: origin.href, views, errors, forbiddenRequests, ...readback };
      if (errors.length || forbiddenRequests.length || !readback.retained || readback.treeMutations || readback.leaves !== 1000 || readback.sceneCount !== 1 || readback.forbiddenElements || readback.forbiddenStyles) throw new Error(JSON.stringify(result));
      results.push(result);
    } finally { await context.close(); }
  }
  return results;
}
