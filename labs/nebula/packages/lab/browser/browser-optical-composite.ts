/** Inspect one staged optical lens without changing the operator's publication or browser state. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const [base, subject, publicationPath, output] = process.argv.slice(2);
if (!base || !subject || !/^[a-z0-9-]+$/.test(subject) || !publicationPath || !output) throw new TypeError('Expected base URL, subject, staged publication and output directory.');
const publication = await readFile(publicationPath, 'utf8'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true }), page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [], posts: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()); });
await page.route(url => url.pathname.endsWith(`/compiler-published/${subject}.json`), route => route.fulfill({ status: 200, contentType: 'application/json', body: publication }));
const snapshot = async (name: string) => {
  await page.evaluate(() => new Promise<void>(accept => requestAnimationFrame(() => requestAnimationFrame(() => accept()))));
  await page.screenshot({ path: `${output}/${name}.png` });
};
async function ready() {
  await page.waitForFunction(() => Boolean(document.querySelector('.compiler-stage [role="alert"], .compiler-progress [role="alert"]')) ||
    document.querySelector('.compiler-stage')?.getAttribute('data-compiler-ready') === 'true', null, { timeout: 60000 });
  assert.deepEqual(await page.locator('.compiler-stage [role="alert"], .compiler-progress [role="alert"]').allTextContents(), []);
}
async function lens(value: string) {
  await page.locator('#compiler-lens').selectOption(value);
  await page.waitForFunction(value => document.querySelector('[data-compiler-root]')?.getAttribute('data-lens') === value, value);
}
try {
  await page.goto(`${base}/reconstruction?subject=${subject}`); await ready();
  const resultId = await page.locator('.compiler-controls').getAttribute('data-result-id'); assert.ok(resultId);
  const sourceLens = await page.locator('#compiler-lens').inputValue();
  const stars = () => page.locator('[data-compiler-stars] s').evaluateAll(nodes => nodes.map(node => {
    const el = node as HTMLElement; return { id: el.dataset.starId, position: el.style.transform, width: el.style.width, alpha: el.style.opacity, tile: el.style.backgroundPosition };
  }));
  const initialStars = await stars(); assert.ok(initialStars.length > 0);
  await snapshot('reference-front'); await lens('optical-composite');
  assert.deepEqual(await stars(), initialStars, 'Optical composition changed the catalogue stars.');
  await snapshot('composite-front');
  await page.getByRole('checkbox', { name: 'Original', exact: true }).check();
  await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('[data-compiler-original-source]'); return image?.complete && image.naturalWidth === 2048; });
  await snapshot('composite-original');
  await page.getByRole('checkbox', { name: 'Original', exact: true }).uncheck();
  const rect = await page.locator('.compiler-stage .shape-cloud-viewport').boundingBox(); assert.ok(rect);
  for (const [name, dx, dy] of [['oblique', 55, 30], ['west-side', 90, 0], ['north-side', 0, 89]] as const) {
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    await page.getByRole('button', { name: 'Orbit', exact: true }).click();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx / .35, y - dy / .35, { steps: 12 }); await page.mouse.up();
    await snapshot(`composite-${name}`);
  }
  const pose = await page.locator('.compiler-stage').getAttribute('data-compiler-pose');
  await lens(sourceLens); await lens('optical-composite');
  assert.equal(await page.locator('.compiler-stage').getAttribute('data-compiler-pose'), pose);
  await page.reload(); await ready();
  assert.equal(await page.locator('.compiler-controls').getAttribute('data-result-id'), resultId);
  assert.equal(await page.locator('#compiler-lens').inputValue(), 'optical-composite');
  assert.deepEqual(errors, []); assert.deepEqual(posts, []);
  await writeFile(`${output}/result.json`, JSON.stringify({ status: 'passed', resultId, retainedStellarElements: initialStars.length,
    originalLens: sourceLens, stagedPublication: publicationPath, front: true, oblique: true, bothSides: true,
    unchangedStars: true, sourceSwitch: true, refresh: true, errors, posts, browser: browser.version() }, null, 2));
  console.log('PASS staged optical lens: source comparison, unchanged stars, front/oblique/both sides, source switch and refresh; no processing.');
} catch (error) { await snapshot('failure'); throw error; } finally { await browser.close(); }
