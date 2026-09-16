import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { assertCompilerSceneRetained, blockProcessingWrites, delayNextBitmap, retainCompilerScene } from './browser-regression';

test('display guard blocks real writes before the server receives them; explicit disposal restores transport', async () => {
  let writes = 0;
  const server = createServer((request, response) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '')) writes++;
    if (request.url === '/__nebula/compiler-jobs/missing' && request.method === 'GET') {
      response.writeHead(404, { 'Content-Type': 'application/json' }); response.end('{"error":"Unknown job"}'); return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<title>Guard fixture</title>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' }), guard = await blockProcessingWrites(context);
    const page = await context.newPage(); await page.goto(`http://127.0.0.1:${address.port}`);
    assert.equal(await page.evaluate(async () => (await fetch('/__nebula/compiler-jobs/missing')).status), 404);
    assert.equal(guard.blocked.length, 0, 'Missing status reads must reach the server without being classified as writes.');
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(await page.evaluate(async method => {
        try { await fetch('/__nebula/compiler-jobs', { method }); return 'sent'; } catch { return 'blocked'; }
      }, method), 'blocked');
    }
    assert.equal(writes, 0); assert.equal(guard.blocked.length, 4);
    await guard.dispose();
    assert.equal(await page.evaluate(async () => (await fetch('/__nebula/compiler-jobs', { method: 'POST' })).status), 200);
    assert.equal(writes, 1, 'The fixture must detect writes if the protection is removed.');
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('retention probe rejects same-count node replacement and complete scene remounts', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div data-compiler-root="fixture"><div class="css-volume-projection"><div class="css-volume-scene"><div class="css-volume-mesh"><s></s></div></div></div><div data-compiler-stars><s></s></div></div>');
    const baseline = await retainCompilerScene(page);
    await page.locator('.css-volume-scene').evaluate(node => { (node as HTMLElement).style.transform = 'rotate(10deg)'; });
    await assertCompilerSceneRetained(page, baseline, 'unchanged identities');
    await page.locator('[data-compiler-root]').evaluate(node => node.after(node.cloneNode(true)));
    await assert.rejects(assertCompilerSceneRetained(page, baseline, 'duplicate scene'), /was replaced/);
    await page.locator('[data-compiler-root]').last().evaluate(node => node.remove());
    await page.locator('.css-volume-mesh s').evaluate(node => node.replaceWith(node.cloneNode(true)));
    await assert.rejects(assertCompilerSceneRetained(page, baseline, 'mutated leaf'), /was replaced/);
    await baseline.dispose();
    const replacement = await retainCompilerScene(page);
    await page.locator('[data-compiler-root]').evaluate(node => node.replaceWith(node.cloneNode(true)));
    await assert.rejects(assertCompilerSceneRetained(page, replacement, 'mutated scene'), /was replaced/);
    await replacement.dispose();
  } finally { await browser.close(); }
});

test('decode probe holds a real bitmap until release and restores the original browser decoder', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); await page.setContent('<output>waiting</output>');
    const png = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#345678' } }).png().toBuffer();
    const probe = await delayNextBitmap(page);
    await page.evaluate(bytes => {
      void createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' })).then(bitmap => {
        document.querySelector('output')!.textContent = `${bitmap.width}×${bitmap.height}`; bitmap.close();
      });
    }, [...png]);
    await probe.held(); assert.equal(await page.locator('output').textContent(), 'waiting');
    await probe.release(); await probe.settled();
    assert.equal(await page.locator('output').textContent(), '2×3');
    await probe.restore();
    assert.equal(await page.evaluate(() => window.__nebulaDecodeProbe === undefined), true);
  } finally { await browser.close(); }
});
