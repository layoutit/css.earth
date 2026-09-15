/** Actual prepared grayscale comparison: registered footprints, shared framing and retained 3D. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readStructureCatalogue } from '../src/features/observations/models/structures-model';

const catalogue = readStructureCatalogue(JSON.parse(await readFile('.local/nebula-lab/observations/helix/structures/catalogue.json', 'utf8')));
const directory = '.local/nebula-lab/shape-cloud/structure-browser'; await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [], checks: unknown[] = []; let posts = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/shape-cloud-jobs')) posts++; });
const modes = page.getByRole('group', { name: 'Cloud comparison mode', exact: true });
async function waitFinal() {
  await page.waitForFunction(() => {
    const state = document.querySelector('.shape-cloud-workbench'), root = document.querySelector('[data-shape-cloud-root]');
    return Boolean(document.querySelector('.shape-cloud-error')) || (root?.getAttribute('data-ready') === 'true' &&
      state?.getAttribute('data-preview-active') === 'false' && state.getAttribute('data-preview-quality') === 'detailed' &&
      state.getAttribute('data-result-id') === root.getAttribute('data-shape-cloud-root'));
  }, null, { timeout: 120_000 });
  assert.deepEqual(await page.locator('.shape-cloud-error').allTextContents(), []);
}
async function waitChannel(channel: string, gain: number) {
  await page.waitForFunction(({ channel, gain }) => {
    const node = document.querySelector('.shape-cloud-diagnostics');
    return Boolean(document.querySelector('.shape-cloud-error')) || (node?.getAttribute('data-ready') === 'true' &&
      node.getAttribute('data-channel') === channel && node.getAttribute('data-gain') === String(gain));
  }, { channel, gain }, { timeout: 30_000 });
  assert.deepEqual(await page.locator('.shape-cloud-error').allTextContents(), []);
  await page.locator('.shape-cloud-diagnostics img').evaluateAll(async nodes => {
    await Promise.all(nodes.map(node => { if (!(node instanceof HTMLImageElement)) throw new TypeError('Expected image.'); return node.decode(); }));
  });
}
async function checkRegistration(expected: string | null, width: number, height: number) {
  const planes = page.locator('[data-comparison-frame]');
  const styles = await planes.evaluateAll(nodes => nodes.map(node => node.getAttribute('style')));
  assert.deepEqual(styles, [expected, expected], 'Diagnostic footprint changed source-to-sky registration.');
  const landmarks = await planes.evaluateAll(nodes => nodes.map(node => {
    if (!(node instanceof HTMLElement) || !(node.parentElement instanceof HTMLElement)) throw new TypeError('Missing diagnostic frame.');
    const registration = new DOMMatrix(getComputedStyle(node).transform), framing = new DOMMatrix(getComputedStyle(node.parentElement).transform);
    return [[0, 0], [.25, .3], [.71, .62], [1, 1]].map(([x, y]) => {
      const point = new DOMPoint(x! * node.offsetWidth, y! * node.offsetHeight).matrixTransform(registration).matrixTransform(framing);
      return [point.x, point.y];
    });
  }));
  assert.deepEqual(landmarks[0], landmarks[1], 'Registered image landmarks disagree between panes.');
  const dimensions = await page.locator('.shape-cloud-diagnostics img').evaluateAll(nodes => nodes.map(node => {
    if (!(node instanceof HTMLImageElement)) throw new TypeError('Expected image.'); return [node.naturalWidth, node.naturalHeight];
  }));
  assert.deepEqual(dimensions, [[width, height], [width, height]], 'Diagnostics cropped or resized the source footprint.');
}
try {
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/reconstruction?subject=helix-model-prior`);
  await page.locator('.shape-cloud-workbench').waitFor();
  assert.equal(await modes.getByRole('button').count(), 4);
  for (const image of catalogue.images) {
    await modes.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.locator('#structure-image').selectOption(image.id);
    await page.locator(`.shape-cloud-workbench[data-image-id="${image.id}"]`).waitFor(); await waitFinal();
    await page.setViewportSize({ width: 1600, height: 1000 });
    const root = page.locator('[data-shape-cloud-root]'), node = await root.elementHandle(); assert.ok(node);
    const registration = await page.locator('[data-cloud-source-frame="source"]').getAttribute('style');
    await page.getByRole('button', { name: 'Unlock rotation', exact: true }).click();
    const cloud = await page.locator('.shape-cloud-output-slot .shape-cloud-viewport').boundingBox(); assert.ok(cloud);
    await page.mouse.move(cloud.x + cloud.width / 2, cloud.y + cloud.height / 2); await page.mouse.down();
    await page.mouse.move(cloud.x + cloud.width / 2 + 60, cloud.y + cloud.height / 2 - 35); await page.mouse.up();
    const pose = await root.getAttribute('data-pose'); assert.notEqual(pose, '0,0');
    await modes.getByRole('button', { name: 'Textured', exact: true }).click();
    const beforePosts = posts;
    await modes.getByRole('button', { name: 'Structure', exact: true }).click();
    assert.equal(await node.evaluate(element => element.isConnected), true, 'Structure mode destroyed the 3D scene.');
    assert.equal(await page.locator('.shape-cloud-three-d').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Unlock rotation', exact: true }).count(), 0);
    const channels = page.getByRole('group', { name: 'Structure channel', exact: true });
    for (const [channel, label] of [['luminosity', 'Luminance'], ['edges', 'Edges'], ['difference', 'Difference']] as const) {
      await channels.getByRole('button', { name: label, exact: true }).click();
      await page.locator('#shape-cloud-levels').press('Home'); await waitChannel(channel, 1);
      await checkRegistration(registration, image.width, image.height);
      const initialPins = await page.locator('.shape-cloud-diagnostics img').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
      await page.locator('#shape-cloud-levels').press('End'); await waitChannel(channel, 8);
      const boostedPins = await page.locator('.shape-cloud-diagnostics img').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
      assert.notDeepEqual(initialPins, boostedPins, 'Levels did not select prepared display images.');
      await page.locator('#shape-cloud-levels').press('Home'); await waitChannel(channel, 1);
      await page.locator('.observation-structures-panel').evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: `${directory}/${image.id}-${channel}-1600.png` });
    }
    const viewport = page.locator('[data-comparison-pane="source"] .shape-cloud-viewport'), bounds = await viewport.boundingBox(); assert.ok(bounds);
    const initialFraming = await page.locator('.shape-cloud-diagnostics .shape-cloud-frame').first().getAttribute('style');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 25); await page.mouse.up();
    await page.mouse.wheel(0, -150);
    await page.waitForFunction(previous => document.querySelector('.shape-cloud-diagnostics .shape-cloud-frame')?.getAttribute('style') !== previous, initialFraming);
    await checkRegistration(registration, image.width, image.height);
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    await page.setViewportSize({ width: 1000, height: 1000 });
    await channels.getByRole('button', { name: 'Luminance', exact: true }).click(); await waitChannel('luminosity', 1);
    await checkRegistration(registration, image.width, image.height);
    const buttons = await modes.getByRole('button').evaluateAll(elements => elements.map(element => ({ height: element.getBoundingClientRect().height,
      width: element.getBoundingClientRect().width, overflow: element.scrollWidth > element.clientWidth + 1 })));
    assert.ok(buttons.every(button => button.height >= 64 && !button.overflow), 'Large mode buttons clipped at 1000px.');
    await page.screenshot({ path: `${directory}/${image.id}-luminosity-1000.png` });
    await modes.getByRole('button', { name: 'Textured', exact: true }).click();
    assert.equal(await node.evaluate(element => element.isConnected), true);
    assert.equal(await root.getAttribute('data-pose'), pose, 'Diagnostics replaced the 3D camera.');
    assert.equal(await root.getAttribute('data-material'), 'textured', 'Diagnostics replaced the 3D material.');
    assert.equal(posts, beforePosts, 'Diagnostic channel, levels or framing triggered a bake.');
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    checks.push({ imageId: image.id, footprint: [image.width, image.height], channels: 3, viewportWidths: [1000, 1600], retainedPose: pose });
  }
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', checks, posts }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks, posts }));
} catch (error) { await page.screenshot({ path: `${directory}/failure.png` }); throw error; }
finally { await browser.close(); }
