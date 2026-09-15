import { chooseLabObject } from './browser-object-picker.ts';
/** Focused, read-only check of the planetary-nebula experiment in the real lab. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const subjectId = process.argv[2] ?? 'm2-9-inferred';
if (!/^[a-z0-9-]+$/.test(subjectId)) throw new TypeError('Invalid experiment subject.');
const directory = `.local/nebula-lab/planetary/browser${process.argv[2] ? `/${subjectId}` : ''}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors: string[] = [], writes: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
try {
  await page.goto(`http://127.0.0.1:4331/reconstruction?subject=${subjectId}`);
  await page.locator(`#viewer[data-ready="true"][data-subject="${subjectId}"]`).waitFor();
  const volumeButton = page.getByRole('button', { name: 'Volume', exact: true });
  if (await volumeButton.count()) await volumeButton.click();
  await page.locator('#camera-pose:not([disabled])').waitFor();
  assert.equal(await page.locator('#subject').getAttribute('data-object-id'), subjectId);
  assert.ok(await page.locator('.css-volume-mesh s').count() > 100, 'Must use prepared PolyCSS geometry.');
  assert.equal(await page.locator('#viewer canvas, #viewer svg').count(), 0);
  for (const pose of ['front', 'y-plus-60', 'edge-y', 'edge-x', 'front']) {
    await page.locator('#camera-pose').selectOption(pose);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${directory}/${pose}.png` });
  }
  const before = await page.locator('#viewer').getAttribute('data-subject');
  await page.mouse.move(780, 530); await page.mouse.down(); await page.mouse.move(870, 565, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#camera-pose').inputValue(), 'manual');
  assert.equal(await page.locator('#viewer').getAttribute('data-subject'), before);
  await page.reload();
  await page.locator(`#viewer[data-ready="true"][data-subject="${subjectId}"]`).waitFor();
  if (await volumeButton.count()) await volumeButton.click();
  const peer = process.argv[3];
  if (peer) {
    await page.locator('#camera-pose').selectOption('y-plus-60');
    await chooseLabObject(page, peer);
    await page.locator(`#viewer[data-ready="true"][data-subject="${peer}"]`).waitFor();
    assert.equal(await page.locator('#camera-pose').inputValue(), 'y-plus-60', 'Comparison switch must retain the view.');
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, errors, writes,
    checks: ['prepared PolyCSS leaves', 'front/oblique/both side screenshots', 'pointer rotation', 'refresh', 'no processing on mount'] }, null, 2));
  console.log('EMISSION_BROWSER_PASS');
} catch (error) {
  console.error(JSON.stringify({ errors, status: await page.locator('#status').textContent().catch(() => null),
    text: (await page.locator('body').innerText()).slice(-1500) }));
  await page.screenshot({ path: `${directory}/failure.png` });
  throw error;
} finally { await browser.close(); }
