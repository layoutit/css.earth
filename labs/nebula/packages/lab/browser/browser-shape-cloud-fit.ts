/** The actual delivered fit: direct URL, prepared rendering, editable isolated drafts and reload. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readShapeCloudPreset } from '../src/server/workflows/shape-cloud/presets.ts';
const preset = readShapeCloudPreset(JSON.parse(await readFile('labs/nebula/models/helix/tuned-shape-fit.json', 'utf8')));
const output = '.local/nebula-lab/helix-tuned'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true }), context = await browser.newContext({ viewport: { width: 1800, height: 1100 } });
const page = await context.newPage(), errors: string[] = [], requests: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()); });
async function ready() {
  await page.waitForFunction(() => {
    const s = document.querySelector('.shape-cloud-workbench'), root = document.querySelector('[data-shape-cloud-root]');
    return !!document.querySelector('.shape-cloud-error') || s?.getAttribute('data-preview-quality') === 'detailed' && s.getAttribute('data-preview-active') === 'false' &&
      s.getAttribute('data-preview-current') === 'true' && s.getAttribute('data-result-id') === root?.getAttribute('data-shape-cloud-root') && root?.getAttribute('data-ready') === 'true';
  }, null, { timeout: 120_000 });
  assert.deepEqual(await page.locator('.shape-cloud-error').allTextContents(), []);
}
async function screenshot(name: string) {
  await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
  await page.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  await page.screenshot({ path: `${output}/${name}.png` });
}
try {
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/reconstruction?subject=helix-model-prior&fit=helix-tuned`); await ready();
  assert.equal(await page.locator('#structure-image').inputValue(), preset.imageId);
  assert.equal(await page.locator('#shape-cloud-fit').inputValue(), preset.id);
  assert.equal(await page.getByRole('button', { name: 'Textured', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#shape-cloud-weight').inputValue(), String(preset.settings.components[0]!.weight));
  assert.equal(await page.locator('#shape-cloud-component option').count(), 6);
  await screenshot('front'); console.log('Saved tuned front view');
  const resultId = await page.locator('.shape-cloud-workbench').getAttribute('data-result-id'); assert.ok(resultId);
  const before = requests.length; await page.reload(); await ready(); assert.equal(requests.length, before, 'Reload baked a completed fit again.');
  assert.equal(await page.locator('.shape-cloud-workbench').getAttribute('data-result-id'), resultId);
  await page.getByRole('button', { name: 'Unlock rotation', exact: true }).click();
  const area = await page.locator('.shape-cloud-output-slot .shape-cloud-viewport').boundingBox(); assert.ok(area);
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 + 165, area.y + area.height / 2 - 100, { steps: 12 }); await page.mouse.up();
  await screenshot('oblique');
  assert.notEqual(await page.locator('[data-shape-cloud-root]').getAttribute('data-pose'), '0,0');
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2); await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 + 91, area.y + area.height / 2 + 100, { steps: 10 }); await page.mouse.up();
  await screenshot('side');
  assert.equal(requests.length, before, 'Rotation started processing.');
  await page.getByRole('button', { name: 'Earth view', exact: true }).click();
  await page.getByRole('button', { name: 'Structure', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.shape-cloud-diagnostics')?.getAttribute('data-ready') === 'true');
  await screenshot('structure');
  const legend = await page.locator('.shape-cloud-diagnostic-legend').getAttribute('title');
  // The automatic branch and its user edits remain separate from the named saved fit.
  await page.locator('#shape-cloud-fit').selectOption(''); await ready();
  await page.locator('#shape-cloud-weight').press('ArrowRight'); await ready();
  const automaticWeight = await page.locator('#shape-cloud-weight').inputValue();
  await page.locator('#shape-cloud-fit').selectOption(preset.id); await ready();
  assert.equal(await page.locator('#shape-cloud-weight').inputValue(), String(preset.settings.components[0]!.weight));
  await page.locator('#shape-cloud-weight').press('ArrowRight'); await ready();
  const fitWeight = await page.locator('#shape-cloud-weight').inputValue(); await page.reload(); await ready();
  assert.equal(await page.locator('#shape-cloud-weight').inputValue(), fitWeight);
  await page.getByRole('button', { name: 'Reset to saved fit', exact: true }).click(); await ready();
  assert.equal(await page.locator('#shape-cloud-weight').inputValue(), String(preset.settings.components[0]!.weight));
  await page.locator('#shape-cloud-fit').selectOption(''); await ready();
  assert.equal(await page.locator('#shape-cloud-weight').inputValue(), automaticWeight);
  assert.deepEqual(errors, []);
  const report = { status: 'passed', resultId, legend, components: 6, directUrl: true, isolatedEdits: true, refreshReused: true, rotationDoesNotProcess: true };
  await writeFile(`${output}/result.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) { await screenshot('failure'); throw error; } finally { await browser.close(); }
