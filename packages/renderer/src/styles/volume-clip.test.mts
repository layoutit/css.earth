import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright';

test('image and dataset volume projections clip oversized painted children at their own viewport', async () => {
  const css = await readFile(new URL('./volume.css', import.meta.url), 'utf8');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await page.setContent(`<style>${css}</style><body style="margin:0">
      <div class="prepared-volume-image" style="position:absolute;left:10px;top:10px;width:80px;height:80px">
        <div class="css-volume-projection" style="opacity:.999"><div id="image-child" style="width:300px;height:50px;background:red;pointer-events:auto;transform:translateZ(0)"></div></div>
      </div>
      <div class="prepared-volume-dataset-cloud" style="position:absolute;left:10px;top:110px;width:80px;height:80px">
        <div class="css-volume-projection" style="opacity:.999"><div id="dataset-child" style="width:300px;height:50px;background:red;pointer-events:auto;transform:translateZ(0)"></div></div>
      </div></body>`);
    const actual = await page.evaluate(() => ({
      inside: [document.elementFromPoint(20, 30)?.id, document.elementFromPoint(20, 130)?.id],
      outside: [document.elementFromPoint(140, 30)?.id, document.elementFromPoint(140, 130)?.id],
    }));
    assert.deepEqual(actual.inside, ['image-child', 'dataset-child']);
    assert(!actual.outside.includes('image-child'), 'Image plane escaped its projection viewport');
    assert(!actual.outside.includes('dataset-child'), 'Dataset plane escaped its projection viewport');
  } finally { await browser.close(); }
});
