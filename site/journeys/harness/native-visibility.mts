/** Native headed tabs: CDP's documented noDefaults option avoids Playwright's focus/visibility override. */
import { createServer } from 'node:net';
import { resolve, relative, isAbsolute } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, type Browser, type Page } from 'playwright';
import type { Profile } from './profiles.mts';
import { startCacheGuard } from './cache-guard.mts';
export async function nativeVisibilityBrowser(profile: Profile, temporary: string) {
  if (profile.engine !== 'chromium' || !profile.nativeVisibility || profile.hasTouch || profile.deviceScaleFactor !== 1) throw new Error('Native visibility requires the headed Chromium desktop profile');
  const path = relative(resolve('output'), resolve(temporary));
  if (path.startsWith('..') || isAbsolute(path)) throw new Error('Native visibility browser profile must stay in output');
  const reservation = createServer();
  await new Promise<void>((done, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', done); });
  const address = reservation.address();
  await new Promise<void>((done, reject) => reservation.close(error => error ? reject(error) : done()));
  if (!address || typeof address === 'string') throw new Error('Missing loopback CDP port');
  const guard = await startCacheGuard({ blockServiceWorkers: true });
  let owner: Browser | undefined, browser: Browser | undefined;
  const previousTmp = process.env.TMPDIR; process.env.TMPDIR = resolve(temporary);
  try {
    owner = await chromium.launch({ headless: false, ...guard.launchOptions,
      args: [...guard.launchOptions.args ?? [], `--remote-debugging-port=${address.port}`] });
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${address.port}`, { noDefaults: true });
    await guard.verify(browser);
    const [context] = browser.contexts();
    if (!context || browser.contexts().length !== 1) throw new Error('Missing native default browser context');
    let used = false;
    return {
      browser, cacheGuard: guard,
      async newContext() {
        if (used) throw new Error('Native visibility runs one journey per fresh browser');
        used = true;
        return context;
      },
      async prepare(page: Page) {
        await page.setViewportSize(profile.viewport);
        await page.emulateMedia({ reducedMotion: profile.reducedMotion, colorScheme: profile.colorScheme });
        const actual = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio,
          reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches, touch: navigator.maxTouchPoints }));
        if (actual.width !== profile.viewport.width || actual.height !== profile.viewport.height || actual.dpr !== profile.deviceScaleFactor
          || actual.reduced !== (profile.reducedMotion === 'reduce') || actual.dark !== (profile.colorScheme === 'dark') || actual.touch !== 0)
          throw new Error('Native default context does not match the declared visibility profile');
      },
      async close() { try { await browser?.close(); } finally { try { await owner?.close(); } finally { await guard.close(); } } },
    };
  } catch (error) {
    try { await browser?.close(); } finally { try { await owner?.close(); } finally { await guard.close(); } }
    throw error;
  } finally { if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp; }
}
async function visibility(page: Page, state: 'hidden' | 'visible') {
  const deadline = Date.now() + 5000;
  while (await page.evaluate(() => document.visibilityState) !== state) {
    if (Date.now() >= deadline) throw new Error(`Native tab activation did not produce ${state}; use chromium-desktop-visibility`);
    await delay(5);
  }
}
/** Uses real tab activation; the optional callback can inspect native hidden playback before foreground return. */
export async function nativeVisibilityTransition(page: Page, hidden?: () => Promise<void>) {
  if (await page.evaluate(() => document.visibilityState) !== 'visible') throw new Error('Visibility transition must depart from a visible page');
  const other = await page.context().newPage();
  try {
    await other.bringToFront(); await visibility(page, 'hidden');
    await hidden?.();
    await page.bringToFront(); await visibility(page, 'visible');
  } finally { await other.close(); await page.bringToFront(); }
}
