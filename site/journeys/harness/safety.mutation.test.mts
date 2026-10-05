/** Real-browser proofs for blocked foreign requests, passive decode and saved assertion traces. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { startServer } from './server.mts';
import { recorder } from './recorder.mts';
import { journeyApi } from './api.mts';
import { parseTrace } from './trace.mts';
const enabled = process.env.JOURNEY_MUTATIONS === '1', exec = promisify(execFile);
const fixture = (ready: string) => `<!doctype html><title>Observer safety</title><style>
  .never-visible { display:none; background-image:url('/observer-only.png'); }
  </style><div class="never-visible"></div><script>document.documentElement.dataset.ready=${JSON.stringify(ready)}</script>`;
test('foreign traffic is blocked and decode never loads unseen background images', { skip: !enabled, timeout: 30000 }, async () => {
  await mkdir('output/journeys', { recursive: true });
  const root = await mkdtemp(resolve('output/journeys/observer-safety-'));
  try {
    const dist = resolve(root, 'dist');
    await mkdir(resolve(dist, 'scenes'), { recursive: true }); await mkdir(resolve(dist, 'dione'), { recursive: true });
    await writeFile(resolve(dist, 'dione/index.html'), fixture('true'));
    const server = await startServer(dist);
    try {
      for (const engine of ['chromium', 'webkit'] as const) {
        const browser = await (engine === 'chromium' ? chromium : webkit).launch();
        try {
          const context = await browser.newContext();
          // This terminal route makes the probe safe even if the blocking detector is absent: no foreign socket opens.
          await context.route('https://journey.invalid/**', route => route.fulfill({ body: 'must not reach this route' }));
          const page = await context.newPage(); await page.clock.install({ time: new Date('2026-01-01') });
          const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'observer-safety', profile: engine,
            toolchain: {}, exercises: [], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
          const record = await recorder(page, trace, server.origin, resolve(root, engine), engine);
          await journeyApi(page, server.origin, record).load('/dione/', 'direct');
          await page.evaluate(() => fetch('https://journey.invalid/request').catch(() => null));
          await record.save();
          assert.ok(trace.observations.errors.some(row => row.data && typeof row.data === 'object' && !Array.isArray(row.data) && row.data.source === 'foreign-request'));
          assert.ok(!trace.observations.network.some(row => row.data && typeof row.data === 'object' && !Array.isArray(row.data) && String(row.data.url).endsWith('/observer-only.png')));
          await context.close();
        } finally { await browser.close(); }
      }
    } finally { await server.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('runner assertions exit 1 with errors and focused partial content in both engines', { skip: !enabled, timeout: 30000 }, async () => {
  await mkdir('output/journeys', { recursive: true });
  const root = await mkdtemp(resolve('output/journeys/assertion-trace-'));
  try {
    const dist = resolve(root, 'dist');
    for (const folder of ['scenes', '_astro', 'milky-way']) await mkdir(resolve(dist, folder), { recursive: true });
    await writeFile(resolve(dist, 'milky-way/index.html'), fixture('error'));
    for (const engine of ['chromium', 'webkit']) {
      const out = resolve(root, engine);
      await assert.rejects(exec(process.execPath, ['site/journeys/run.mts', '--dist', dist, '--out', out, '--profile', engine + '-desktop', '--journey', 'milky-way', '--repeat', '1']),
        error => error instanceof Error && 'code' in error && error.code === 1 && 'stdout' in error && typeof error.stdout === 'string' && error.stdout.includes('partial traces saved'));
      const trace = parseTrace(JSON.parse(await readFile(resolve(out, 'run-1', engine + '-desktop', 'milky-way/milky-way.trace.json'), 'utf8')));
      assert.ok(trace.observations.errors.some(row => row.data && typeof row.data === 'object' && !Array.isArray(row.data) && row.data.source === 'journey-assertion'));
      assert.ok(trace.observations.content.some(row => row.data && typeof row.data === 'object' && !Array.isArray(row.data) && Object.hasOwn(row.data, 'focus')));
      assert.ok(trace.observations.rendering.some(row => row.screenshot === 'journey-assertion.png'));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
