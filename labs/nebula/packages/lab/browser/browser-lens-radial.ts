/**
 * The live Radial profile panel in the real Reconstruction sidebar, for two image lenses.
 *
 * Read-only: it selects lenses through the page's own image picker and opens the panel, so the measurement
 * arrives through the same route a person browsing the lab hits. Args: [base-url] [output-directory].
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = resolve(process.argv[3] ?? '.local/nebula-lab/lens-radial');
const lenses = ['horalek-widefield', 'vista-infrared'];
await mkdir(output, { recursive: true });

const errors: string[] = [], ignored: string[] = [], report: unknown[] = [];
const browser = await chromium.launch({ headless: true });
try {
  const page: Page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  const note = (text: string) => { (/favicon/.test(text) ? ignored : errors).push(text); };
  page.on('pageerror', error => note(String(error)));
  page.on('console', message => { if (message.type() === 'error') note(`${message.text()} @ ${message.location().url || 'unknown'}`); });
  page.on('response', response => { if (response.status() >= 400) note(`http ${response.status()} ${response.url()}`); });

  const catalogue = await (await fetch(`${base}/__nebula/reconstruction?subjectId=lmc-clouds`)).json();
  assert.ok(catalogue.finiteModel?.modelResultId, 'The LMC needs a discovered finite model to have lenses.');
  await page.goto(`${base}/reconstruction?subject=lmc-clouds`);
  await page.waitForSelector('#reconstruction-image option[value="horalek-widefield"]', { state: 'attached' });
  for (const imageId of lenses) {
    const expected = catalogue.candidates.find((row: { imageId: string }) => row.imageId === imageId);
    assert.ok(expected?.prepared?.resultId, `No baked lens for ${imageId}.`);
    await page.selectOption('#reconstruction-image', imageId);
    await page.waitForFunction(id => document.querySelector('.reconstruction-controls')?.getAttribute('data-reconstruction-result') === id,
      expected.prepared.resultId, { timeout: 120000 });

    // The third round button, under Levels and Difference map.
    const order = await page.locator('.workspace-tool-buttons [data-workspace-tool]').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.workspaceTool));
    assert.deepEqual(order, ['levels', 'difference', 'radial'], `tool order ${order.join(',')}`);
    await page.locator('[data-workspace-tool="radial"]').click();
    const panel = page.locator('.lens-radial-panel');
    await panel.waitFor();
    await page.waitForFunction(id => {
      const node = document.querySelector<HTMLElement>('.lens-radial-panel');
      return node?.dataset.lensRadialState === 'ready' && node.dataset.lensRadialResult === id;
    }, expected.prepared.resultId, { timeout: 120000 });
    const measured = await panel.evaluate(node => ({
      resultId: (node as HTMLElement).dataset.lensRadialResult,
      polylines: node.querySelectorAll('polyline').length,
      canvas: node.querySelectorAll('canvas').length,
      numbers: node.querySelector('.lens-radial-numbers')?.textContent?.trim() ?? '',
      status: node.querySelector('.lens-radial-status')?.textContent?.trim() ?? '',
    }));
    assert.equal(measured.resultId, expected.prepared.resultId);
    // Source, render and ratio strokes, drawn as SVG; never a canvas.
    assert.equal(measured.polylines, 3, `${imageId} polylines ${measured.polylines}`);
    assert.equal(measured.canvas, 0);
    assert.match(measured.numbers, /half-light radius .+px.+rms log ratio .+worst/s);
    assert.match(measured.status, /grid \d+×\d+ · footprint [\d,]+ px/);
    await panel.screenshot({ path: `${output}/radial-${imageId}.png` });
    await page.screenshot({ path: `${output}/lab-${imageId}.png` });
    report.push({ imageId, ...measured });
    // Close the panel so the next lens starts from the same closed state.
    await page.locator('.workspace-tool-close').click();
  }
  assert.deepEqual(errors, [], `Console errors: ${errors.join(' | ')}`);
} finally { await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ base, lenses, ignored, report }, null, 2) + '\n');
console.log('LENS_RADIAL_BROWSER_OK', output, JSON.stringify(report.map((row: any) => [row.imageId, row.polylines])));
