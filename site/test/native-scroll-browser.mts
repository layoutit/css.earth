import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { conformanceBrowserLaunch } from './conformance-browser-launch.mts';
const directory = 'output/playwright/native-scroll';
const origin = process.argv[2] ?? 'http://127.0.0.1:4350';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ ...(await conformanceBrowserLaunch({ evidenceDirectory: directory })).options,
  ignoreDefaultArgs: ['--disable-back-forward-cache'] });
try {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 }, recordVideo: { dir: directory, size: { width: 1280, height: 900 } } });
  const page = await context.newPage();
  const failed: string[] = [];
  page.on('response', response => { if (!response.ok()) failed.push(`${response.status()} ${response.url()}`); });
  const response = await page.goto(new URL('/saturn/', origin).href);
  assert.equal(response?.status(), 200, (await page.locator('body').innerText()).slice(0,500));
  await page.waitForTimeout(1200);
  const state = () => page.locator('.planet-input-surface').evaluate(node => {
    const scene = document.querySelector('.polycss-scene')!;
    const style = getComputedStyle(scene);
    const centre = scene.getBoundingClientRect();
    // The zoom distance is animated on the viewport; scene elements that never read it do not inherit it.
    return { centre: { x: centre.x, y: centre.y }, scroll: node.scrollTop, range: node.scrollHeight - node.clientHeight,
      logDistance: getComputedStyle(document.querySelector('.planet-viewport')!).getPropertyValue('--native-log-distance'), translate: style.translate,
      sceneCount: document.querySelectorAll('.polycss-scene').length,
      skyCount: document.querySelectorAll('.prepared-celestial-sky').length,
      skyFaces: [...document.querySelectorAll('.prepared-celestial-sky [data-sky-face]')].map(node => ({ visible: getComputedStyle(node).visibility, image: getComputedStyle(node).backgroundImage })),
      markers: [...document.querySelectorAll<HTMLAnchorElement>('.native-context-link')].map(node => {
        const rect = node.getBoundingClientRect(); return { id: node.dataset.nativeDestination, x: rect.x, y: rect.y, visibility: getComputedStyle(node).visibility }; }),
      orbits: [...document.querySelectorAll('.context-orbit')].map(node => ({ id: node.getAttribute('data-context-orbit'), opacity: getComputedStyle(node).opacity, leaves: node.childElementCount })),
      timeline: CSS.supports('animation-timeline: scroll()'), initial: CSS.supports('scroll-initial-target: nearest') };
  });
  const initial = await state(); console.log('INITIAL', JSON.stringify(initial));
  await page.screenshot({ path: `${directory}/initial.png` });
  assert.equal(initial.sceneCount, 1); assert.equal(initial.skyCount, 1); assert.equal(initial.scroll, 400);
  assert.ok(Math.abs(Number(initial.logDistance)) < 1e-5);
  assert.ok(Math.abs(initial.centre.x - 640) < 1 && Math.abs(initial.centre.y - 450) < 1, 'The initial body must remain centred.');
  await page.mouse.move(840, 750);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(180); }
  await page.waitForTimeout(1200);
  const solar = await state(); console.log('SOLAR', JSON.stringify(solar));
  await page.screenshot({ path: `${directory}/solar.png` });
  assert.equal(solar.scroll, solar.range); assert.ok(Number(solar.logDistance) > 10);
  assert.equal(solar.sceneCount, 1); assert.equal(solar.skyCount, 1);
  await page.mouse.wheel(600, 0); await page.waitForTimeout(200);
  assert.equal((await state()).scroll, solar.scroll);
  const destination = page.locator('a[data-native-destination="neptune"]');
  await destination.click();
  await page.waitForURL('**/neptune/'); await page.waitForTimeout(1200);
  assert.equal(await page.locator('.planet-stage').getAttribute('data-object-id'), 'neptune');
  const arrival = await state(); console.log('ARRIVAL', JSON.stringify(arrival));
  await page.screenshot({ path: `${directory}/neptune.png` });
  assert.equal(arrival.sceneCount, 1); assert.equal(arrival.skyCount, 1); assert.equal(arrival.scroll, 400);
  await page.goBack({ waitUntil: 'commit' }); await page.waitForTimeout(1000);
  const back = await state(); console.log('BACK', JSON.stringify(back));
  const backRestored = back.scroll === solar.scroll;
  const backReason = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return navigation && 'notRestoredReasons' in navigation ? navigation.notRestoredReasons : null;
  });
  console.log('BACK RESTORATION', JSON.stringify({ backRestored, backReason }));
  assert.equal(backRestored, true, 'Back must retain the native zoom position.');
  await page.locator('.planet-input-surface').focus();
  let reached = false;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.getAttribute('data-native-destination')) === 'neptune') { reached = true; break; }
  }
  assert.equal(reached, true, 'Native planet links must be reachable by keyboard.');
  await page.keyboard.press('Enter'); await page.waitForURL('**/neptune/');
  assert.equal(await page.locator('.planet-stage').getAttribute('data-object-id'), 'neptune');
  assert.deepEqual(failed, []);
  await writeFile(`${directory}/report.json`, JSON.stringify({ initial, solar, arrival, back, backRestored, backReason, keyboard: reached, failed }, null, 2));
  await context.close(); console.log('VIDEO', await page.video()?.path());
} finally { await browser.close(); }
