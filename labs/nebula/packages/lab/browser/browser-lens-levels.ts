/**
 * The live Levels panel in the real Reconstruction sidebar, for two image lenses.
 *
 * Read-only: it selects lenses through the page's own image picker and opens the panel, so the measurement
 * arrives through the same route a person browsing the lab hits. Args: [base-url] [output-directory].
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:4331';
const output = resolve(process.argv[3] ?? '.local/nebula-lab/lens-levels');
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
    const panel = page.locator('.lens-levels-panel');
    await panel.waitFor();
    if (!(await panel.evaluate(node => (node as HTMLDetailsElement).open))) await panel.locator('summary').click();
    await page.waitForFunction(id => {
      const node = document.querySelector<HTMLElement>('.lens-levels-panel');
      return node?.dataset.lensLevelsState === 'ready' && node.dataset.lensLevelsResult === id;
    }, expected.prepared.resultId, { timeout: 120000 });
    const measured = await panel.evaluate(node => {
      const rows = [...node.querySelectorAll<HTMLElement>('.lens-levels-row')];
      return { resultId: (node as HTMLElement).dataset.lensLevelsResult,
        channels: rows.map(row => row.dataset.channel),
        polylines: rows.map(row => row.querySelectorAll('polyline').length),
        canvas: node.querySelectorAll('canvas').length,
        numbers: rows.map(row => row.querySelector('.lens-levels-numbers')?.textContent?.trim() ?? ''),
        header: node.querySelector('.lens-levels-status')?.textContent?.trim() ?? '' };
    });
    assert.deepEqual(measured.channels, ['R', 'G', 'B'], `${imageId} needs one row per channel.`);
    // Two histograms, the delta and the transfer, drawn as SVG strokes; never a canvas.
    assert.ok(measured.polylines.every(count => count === 4), `${imageId} polylines ${measured.polylines.join(',')}`);
    assert.equal(measured.canvas, 0);
    for (const line of measured.numbers) assert.match(line, /p50 .+×.+p90 .+×.+mean .+\|mean\| .+DN.+worst/s);
    assert.match(measured.header, /grid \d+×\d+ · footprint [\d,]+ px/);
    await panel.screenshot({ path: `${output}/levels-${imageId}.png` });
    await page.screenshot({ path: `${output}/lab-${imageId}.png` });
    report.push({ imageId, ...measured });
  }
  assert.deepEqual(errors, [], `Console errors: ${errors.join(' | ')}`);
} finally { await browser.close(); }
await writeFile(`${output}/report.json`, JSON.stringify({ base, lenses, ignored, report }, null, 2) + '\n');
console.log('LENS_LEVELS_BROWSER_OK', output, JSON.stringify(report.map((row: any) => [row.imageId, row.polylines])));
