import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const output = 'output/playwright/retained-leaf-pool';
const overview = '/sun/?overview=solar-system&v=QMY-Wp0Ui2g9eAAAAAAAAAAAwhaDLpsLNZhBQsczQAAAAD_WST4rO1jov9dbC19kads_3S3JdnPBsgABAAAAAAAAAAA';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], errors = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1995, height: 1236 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + overview);
    await page.waitForFunction(() => window.__cssEarth?.ready);
    const motion = page.locator('input[name="motion"]');
    if (await motion.isChecked()) await motion.uncheck({ force: true });
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.context-orbit-block, .prepared-point-field-block')];
      window.__poolProof = {
        blocks, leaves: blocks.flatMap(block => [...block.children]),
        parents: blocks.flatMap(block => [...block.children].map(leaf => leaf.parentNode)),
        navigations: [], maximumScenes: 0, sampling: true,
      };
      const sample = () => {
        const t = window.__poolProof;
        t.maximumScenes = Math.max(t.maximumScenes, document.querySelectorAll('.planet-stage > .polycss-camera').length);
        if (t.sampling) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      document.addEventListener('objectnavigate', event => window.__poolProof.navigations.push(event.detail.objectId));
      return { blocks: blocks.length, dormant: blocks.filter(b => b.style.display === 'none').length,
        leaves: window.__poolProof.leaves.length };
    });
    assert.ok(before.dormant > 20);
    const culled = await page.screenshot({ path: `${output}/culled-${dpr}.png` });
    // The unculled reference keeps every unused slot in layout, as before.
    await page.evaluate(() => {
      window.__poolProof.dormant = window.__poolProof.blocks.filter(b => b.style.display === 'none');
      for (const block of window.__poolProof.dormant) block.style.display = 'contents';
    });
    const unculled = await page.screenshot({ path: `${output}/unculled-${dpr}.png` });
    await page.evaluate(() => { for (const block of window.__poolProof.dormant) block.style.display = 'none'; });
    const a = PNG.sync.read(culled), b = PNG.sync.read(unculled), diff = new PNG({ width: a.width, height: a.height });
    const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0, includeAA: true });
    await writeFile(`${output}/diff-${dpr}.png`, PNG.sync.write(diff));
    assert.equal(changed, 0, 'Dormant subtree exclusion must preserve the exact rendered image');

    const pick = await page.evaluate(() => {
      const stage = document.querySelector('.planet-stage').getBoundingClientRect();
      for (const orbit of document.querySelectorAll('[data-context-orbit]')) {
        const indicator = document.querySelector(`[data-context-indicator="${orbit.dataset.contextOrbit}"]`);
        if (!indicator || orbit.ariaDisabled === 'true' || getComputedStyle(indicator).visibility === 'hidden') continue;
        for (const piece of orbit.querySelectorAll('s')) {
          if (Number(piece.style.opacity || 1) <= .1 || getComputedStyle(piece).visibility === 'hidden' || piece.parentNode.style.display === 'none') continue;
          const m = new DOMMatrix(piece.style.transform);
          // Three pixels beside the visible line, inside its existing hit corridor.
          const x = stage.x + stage.width / 2 + m.m41 + m.m11 / 2 + m.m21 * 3;
          const y = stage.y + stage.height / 2 + m.m42 + m.m12 / 2 + m.m22 * 3;
          if (x < 460 || x > innerWidth - 40 || y < 60 || y > innerHeight - 60) continue;
          if (!document.elementsFromPoint(x, y).some(element => element === piece)) continue;
          return { id: orbit.dataset.contextOrbit, x, y, indicatorWidth: indicator.getBoundingClientRect().width };
        }
      }
      return null;
    });
    assert.ok(pick, 'A real orbit hit corridor is available');
    await page.mouse.move(pick.x, pick.y);
    await page.waitForTimeout(200);
    const hover = await page.evaluate(id => {
      const indicator = document.querySelector(`[data-context-indicator="${id}"]`);
      return { hovered: indicator.closest('[data-context-group]').dataset.objectHovered,
        width: indicator.getBoundingClientRect().width,
        cursor: getComputedStyle(document.querySelector('.planet-input-surface')).cursor };
    }, pick.id);
    console.log(JSON.stringify({dpr,pick,hover}));
    assert.equal(hover.hovered, 'true'); assert.equal(hover.cursor, 'pointer');
    assert.ok(hover.width >= pick.indicatorWidth + 3.5, 'Orbit hover still expands the indicator');
    await page.mouse.click(pick.x, pick.y);
    await page.waitForFunction(id => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === id &&
      performance.getEntriesByName('cssEarth:navigation:finished').length > 0, pick.id);
    await page.goBack();
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__cssEarth.activeObjectId === 'sun' &&
      new URL(location.href).searchParams.get('overview') === 'solar-system');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const t = window.__poolProof; t.sampling = false;
      return { stable: t.leaves.every((leaf, index) => leaf.isConnected && leaf.parentNode === t.parents[index]),
        correctBlocks: t.blocks.every(block => (block.style.display === 'none') ===
          [...block.children].every(leaf => leaf.style.visibility === 'hidden')),
        maximumScenes: t.maximumScenes, navigations: t.navigations };
    });
    assert.equal(after.stable, true); assert.equal(after.correctBlocks, true);
    assert.equal(after.maximumScenes, 1); assert.deepEqual(after.navigations, [pick.id]);
    results.push({ dpr, before, changedPixels: changed, pick, hover, after });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify({ results, errors }));
