/** Optional full-bank browser evidence; the caller supplies prepared data and camera publications. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { validatePreparedCssVolume } from '@cssearth/objects';

const directory = process.env.CSSEARTH_HYBRID_FIXTURE_DIRECTORY;
function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value)); return value as Record<string, unknown>;
}
test('the real CSS runtime retains and draws the prepared hybrid bank through every supplied camera', {skip: !directory, timeout: 120_000}, async () => {
  assert.ok(directory);
  const volume = validatePreparedCssVolume(JSON.parse(await readFile(resolve(directory, 'volume.json'), 'utf8')));
  const urls: Record<string, string> = {};
  for (const resource of volume.resources) urls[resource.path] = 'data:image/png;base64,' + (await readFile(resolve(directory, resource.path))).toString('base64');
  const raw: unknown = JSON.parse(await readFile(resolve(directory, 'poses.json'), 'utf8')); assert.ok(Array.isArray(raw) && raw.length > 0);
  const bundle = await build({entryPoints: [fileURLToPath(new URL('./hybrid-browser.fixture.ts', import.meta.url))], bundle: true, write: false, format: 'iife', globalName: 'hybridProbe', platform: 'browser'});
  const browser = await chromium.launch({headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const captures: string[] = [];
  try {
    const page = await browser.newPage({deviceScaleFactor: 1});
    await page.setContent('<html><head></head><body style="margin:0;background:#000;overflow:hidden"></body></html>');
    await page.addStyleTag({content: await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../styles/volume.css'), 'utf8')});
    assert.ok(bundle.outputFiles[0]); await page.addScriptTag({content: bundle.outputFiles[0].text});
    const count = await page.evaluate(async input => {
      const api: unknown = Reflect.get(globalThis, 'hybridProbe'); if (!api || typeof api !== 'object') throw new Error('Missing browser fixture');
      const load: unknown = Reflect.get(api, 'load'); if (typeof load !== 'function') throw new Error('Missing fixture load');
      return await load(input.volume, input.urls);
    }, {volume, urls});
    assert.equal(count, 33);
    await mkdir(resolve(directory, 'captures'), {recursive: true});
    for (const value of raw) {
      const pose = record(value), name = pose.name, width = pose.width, height = pose.height;
      assert.ok(typeof name === 'string' && /^[\w.-]+$/u.test(name));
      assert.ok(typeof width === 'number' && Number.isInteger(width) && width > 0 && typeof height === 'number' && Number.isInteger(height) && height > 0);
      await page.setViewportSize({width, height});
      assert.equal(await page.evaluate(async input => {
        const api: unknown = Reflect.get(globalThis, 'hybridProbe'); if (!api || typeof api !== 'object') throw new Error('Missing fixture');
        const publish: unknown = Reflect.get(api, 'publish'); if (typeof publish !== 'function') throw new Error('Missing fixture publication');
        return await publish(input.camera, input.layout);
      }, {camera: pose.camera, layout: pose.layout}), 33);
      await page.screenshot({path: resolve(directory, 'captures', name + '.png')}); captures.push(name);
    }
    await writeFile(resolve(directory, 'browser-complete.json'), JSON.stringify({complete: true, opticalLayers: count, retained: true, cameras: captures}, null, 2) + '\n');
    console.log('HYBRID_BROWSER_CAPTURE_COMPLETE ' + captures.length);
  } finally { await browser.close(); }
});
