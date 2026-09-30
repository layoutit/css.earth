import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';

test('radial panel plots dark bins and replaces the measurement when the dataset changes', async () => {
  const root = process.cwd();
  const fixture = await build({ stdin: { loader: 'tsx', resolveDir: root, contents: `
    import { useState } from 'react'; import { createRoot } from 'react-dom/client';
    import { DatasetRadialPanel } from './labs/nebula/packages/lab/src/features/reconstruction/dataset-radial-panel';
    function App() { const [id, setId] = useState('first-model-first-dataset');
      return <><DatasetRadialPanel resultId={id}/><button onClick={() => setId('second-model-second-dataset')}>Next dataset</button></>; }
    createRoot(document.getElementById('fixture')).render(<App/>);` },
    bundle: true, write: false, format: 'iife', platform: 'browser', outfile: 'fixture.js',
    loader: { '.css': 'empty' }, jsx: 'automatic' });
  const script = fixture.outputFiles[0]?.text;
  assert.ok(script);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/__nebula/reconstruction-radial') {
      const resultId = url.searchParams.get('resultId');
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ schema: 'cssearth-nebula-dataset-radial@1', resultId,
        imageId: resultId?.startsWith('first') ? 'first-dataset' : 'second-dataset',
        grid: { width: 10, height: 10 }, bins: 3, footprintPixels: 100, maxRadius: 5,
        radialBins: [0, 1, 2].map(index => ({ radius: index + 1, pixels: 10,
          sourceMean: 100, renderMean: index ? 100 : 0, ratio: index ? 1 : 0, signedDelta: index ? 0 : -100 })),
        halfLightRadiusSource: 2, halfLightRadiusRender: 3, halfLightRadiusRatio: 1.5,
        rmsLogRatio: 20, worstBin: { radius: 1, ratio: 0, pixels: 10 }, note: 'Test measurement' }));
    } else {
      response.setHeader('Content-Type', url.pathname === '/fixture.js' ? 'text/javascript' : 'text/html');
      response.end(url.pathname === '/fixture.js' ? script : '<div id="fixture"></div><script src="/fixture.js"></script>');
    }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    for (const id of ['first-model-first-dataset', 'second-model-second-dataset']) {
      await page.waitForSelector(`[data-dataset-radial-state="ready"][data-dataset-radial-result="${id}"]`);
      const lines = page.locator('.dataset-radial-plot polyline');
      assert.equal(await lines.count(), 3);
      const points = (await lines.nth(2).getAttribute('points'))?.split(' ') ?? [];
      assert.equal(points.length, 3, 'the zero-ratio core must remain plotted');
      assert.ok(Number(points[0]?.split(',')[1]) > Number(points[1]?.split(',')[1]), 'the dark core must be below the matched annulus');
      assert.match(await page.locator('.dataset-radial-numbers').innerText(), /worst ×0\.00/);
      assert.match(await page.locator('.dataset-radial-status').innerText(), id.startsWith('first') ? /first-dataset/ : /second-dataset/);
      if (id.startsWith('first')) await page.getByRole('button', { name: 'Next dataset' }).click();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>(done => server.close(() => done()));
  }
});
