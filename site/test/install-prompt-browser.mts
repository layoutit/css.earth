// The header's Install button in real engines. Chromium must be given a
// non-incognito profile, because it never offers to install from incognito.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { build } from 'esbuild';
import { chromium, firefox, webkit, type Page } from 'playwright';

const MODULE = fileURLToPath(new URL('../install-prompt.mts', import.meta.url));
const selected = (process.env.INSTALL_PROMPT_ENGINES ?? 'chromium,webkit,firefox').split(',');

async function site() {
  const script = (await build({
    stdin: { contents: `import { bindInstallPrompt } from ${JSON.stringify(MODULE)}; bindInstallPrompt(window);`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'iife', target: 'es2022', write: false,
  })).outputFiles[0]!.text;
  const files: Record<string, [string, () => Promise<Buffer | string>]> = {
    '/': ['text/html', async () => `<!doctype html><title>install fixture</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="manifest" href="/manifest.webmanifest"><link rel="stylesheet" href="/shell-layout.css">
<body><header class="explorer-shell-header"><div class="planet-header-actions">
<button class="planet-header-action planet-install-action" type="button" data-install-app aria-label="Install cssEarth">i</button>
</div></header><script src="/install.js"></script>`],
    '/install.js': ['text/javascript', async () => script],
    '/shell-layout.css': ['text/css', () => readFile('site/shell-layout.css')],
    '/manifest.webmanifest': ['application/manifest+json', () => readFile('public/manifest.webmanifest')],
  };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://site').pathname;
    const icon = path.startsWith('/app-icons/') ? readFile(join('public', path)) : null;
    const entry = files[path];
    if (!entry && !icon) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'content-type': entry?.[0] ?? 'image/png' });
    response.end(await (entry ? entry[1]() : icon));
  });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/`, close: () => new Promise(accept => server.close(accept)) };
}

const visible = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector('[data-install-app]')!).display !== 'none');
const installable = (page: Page) => page.evaluate(() => document.documentElement.dataset.installable === 'true');

if (selected.includes('chromium')) {
  test('chromium: the button appears when Chrome offers to install, and one click uses the offer', async t => {
    const { base, close } = await site();
    const profile = mkdtempSync(join(tmpdir(), 'cssearth-install-'));
    const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, viewport: { width: 1280, height: 720 } });
    t.after(async () => { await context.close(); await close(); rmSync(profile, { recursive: true, force: true }); });
    const page = context.pages()[0] ?? await context.newPage();
    await page.goto(base);
    // Chrome's own offer, not a synthetic event.
    await page.waitForFunction(() => document.documentElement.dataset.installable === 'true', null, { timeout: 15_000 });
    assert.equal(await visible(page), true);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await visible(page), false, 'phones keep every header slot; Android shows its own banner');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.click('[data-install-app]');
    assert.equal(await installable(page), false);
    assert.equal(await visible(page), false);
  });
}

for (const [name, engine] of [['webkit', webkit], ['firefox', firefox]] as const) {
  if (!selected.includes(name)) continue;
  test(`${name}: no install offer, so the button never shows`, async t => {
    const { base, close } = await site();
    const browser = await engine.launch({ headless: true });
    t.after(async () => { await browser.close(); await close(); });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(base);
    await page.waitForTimeout(2000);
    assert.equal(await installable(page), false);
    assert.equal(await visible(page), false);
  });
}
