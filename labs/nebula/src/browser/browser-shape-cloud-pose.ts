import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { checkShapeCloudLinkedPose } from './check-shape-cloud-linked-pose';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = []; let posts = 0;
page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (request.method() === 'POST') posts++; });
const directory = '.local/nebula-lab/shape-cloud/pose-browser'; await mkdir(directory, { recursive: true });
try {
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/reconstruction?subject=helix-model-prior`);
  await page.waitForFunction(() => {
    const state = document.querySelector('.shape-cloud-workbench'), root = document.querySelector('[data-shape-cloud-root]');
    return Boolean(document.querySelector('.shape-cloud-error')) || (root?.getAttribute('data-ready') === 'true' &&
      state?.getAttribute('data-preview-active') === 'false' && state.getAttribute('data-preview-quality') === 'detailed' &&
      state.getAttribute('data-result-id') === root.getAttribute('data-shape-cloud-root'));
  }, null, { timeout: 120_000 });
  const messages = await page.locator('.shape-cloud-error').allTextContents(); assert.equal(messages.length, 0, messages.join('\n'));
  const initialPosts = posts, result = await checkShapeCloudLinkedPose(page);
  assert.equal(posts, initialPosts, 'Pose input prepared new assets.'); assert.deepEqual(errors, []);
  await page.getByRole('button', { name: 'Unlock rotation', exact: true }).click();
  const viewport = await page.locator('.shape-cloud-source-slot .shape-cloud-viewport').boundingBox(); assert.ok(viewport);
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + viewport.height / 2); await page.mouse.down();
  await page.mouse.move(viewport.x + viewport.width / 2 + 150, viewport.y + viewport.height / 2 - 65); await page.mouse.up();
  await page.screenshot({ path: `${directory}/linked-oblique.png` });
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', ...result, posts }, null, 2));
  console.log(JSON.stringify({ status: 'passed', ...result, posts }));
} catch (error) { await page.screenshot({ path: `${directory}/failure.png` }); throw error; }
finally { await browser.close(); }
