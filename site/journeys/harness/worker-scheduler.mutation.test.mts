/** Worker scheduling qualification: exact writes survive deterministic native-reply release. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit, type Browser } from 'playwright';
import { startServer } from './server.mts';
import { recorder } from './recorder.mts';
import { journeyApi } from './api.mts';
import { parseTrace } from './trace.mts';
import { compareDirectories } from './differ.mts';
const enabled = process.env.JOURNEY_MUTATIONS === '1';
const mutations: Record<string, string> = {
  'wrong-final': "node.setAttribute('data-result', 'wrong')",
  'missing-write': '',
  'extra-write': "node.setAttribute('data-result', '2'); node.setAttribute('data-result', '2')",
  'transient-detach': 'const parent = node.parentNode; node.remove(); parent.append(node)',
};
async function capture(browser: Browser, engine: string, origin: string, out: string, scheduleWorkers: boolean, mutation = 'control') {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await context.newPage();
  try {
    await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
    await page.clock.pauseAt(new Date('2026-01-01'));
    const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'worker-scheduler', profile: engine, toolchain: {}, exercises: ['fixture:worker-scheduler'],
      observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
    const recording = await recorder(page, trace, origin, out, engine, { scheduleWorkers }), api = journeyApi(page, origin, recording);
    await api.load('/milky-way/', 'ready');
    const replies: unknown = await page.evaluate(() => Reflect.get(window, 'replies'));
    assert.deepEqual(replies, scheduleWorkers ? [1, 2] : [2, 1]);
    recording.setStep('after');
    const script = mutation === 'control' ? "node.setAttribute('data-result', '2')" : mutations[mutation];
    if (script === undefined) throw new Error('Unknown scheduler mutation');
    await page.evaluate(`(() => { const node = document.querySelector('i'); ${script} })()`);
    await api.barrier('after', '/milky-way/'); await recording.save();
  } finally { await context.close(); }
}
test('worker reply release retains exact final values, counts and lifecycles', { skip: !enabled, timeout: 120000 }, async t => {
  const root = resolve('output/journeys/worker-scheduler-mutations');
  await mkdir(resolve(root, 'dist/scenes'), { recursive: true });
  await mkdir(resolve(root, 'dist/milky-way'), { recursive: true });
  await mkdir(resolve(root, 'tmp'), { recursive: true }); process.env.TMPDIR = resolve(root, 'tmp');
  await writeFile(resolve(root, 'dist/milky-way/index.html'), `<!doctype html><title>Worker scheduling</title><i style="display:none"></i><script>
    window.replies = []; document.documentElement.dataset.ready = 'true';
    const worker = new Worker('/worker.js');
    worker.onmessage = event => { window.replies.push(event.data.id); document.querySelector('i').setAttribute('data-result', String(event.data.id)); };
    worker.postMessage({ id: 1, delay: 40 }); worker.postMessage({ id: 2, delay: 0 });
  </script>`);
  await writeFile(resolve(root, 'dist/worker.js'), 'onmessage = event => setTimeout(() => postMessage({ id: event.data.id }), event.data.delay);');
  const server = await startServer(resolve(root, 'dist'));
  try {
    for (const engine of ['chromium', 'webkit'] as const) {
      const browser = await (engine === 'chromium' ? chromium : webkit).launch({ headless: true });
      try {
        const directory = resolve(root, engine);
        await capture(browser, engine, server.origin, resolve(directory, 'base'), true);
        await capture(browser, engine, server.origin, resolve(directory, 'control'), true);
        assert.deepEqual(await compareDirectories(resolve(directory, 'base'), resolve(directory, 'control')), []);
        for (const mutation of Object.keys(mutations)) await t.test(`${engine} ${mutation}`, async () => {
          await capture(browser, engine, server.origin, resolve(directory, mutation), true, mutation);
          const differences = await compareDirectories(resolve(directory, 'base'), resolve(directory, mutation));
          assert.deepEqual([...new Set(differences.map(row => row.family))], ['dom']);
        });
        // Deleting scheduling changes native delivery order, and the exact DOM family must turn red.
        await capture(browser, engine, server.origin, resolve(directory, 'deleted'), false);
        const differences = await compareDirectories(resolve(directory, 'base'), resolve(directory, 'deleted'));
        assert.deepEqual([...new Set(differences.map(row => row.family))], ['dom']);
      } finally { await browser.close(); }
    }
  } finally { await server.close(); }
});

test('initialization failure releases the queue and remains errors-only red', { skip: !enabled, timeout: 60000 }, async t => {
  const root = resolve('output/journeys/worker-protocol-mutations');
  await mkdir(resolve(root, 'dist/scenes'), { recursive: true });
  await mkdir(resolve(root, 'dist/milky-way'), { recursive: true });
  await writeFile(resolve(root, 'dist/milky-way/index.html'), `<!doctype html><title>Protocol completion</title><script>
    document.documentElement.dataset.ready = 'true';
    const worker = new Worker('/worker.js');
    worker.postMessage({ validatedPlan: true, fail: window.__journeyProtocolFailure === true });
  </script>`);
  await writeFile(resolve(root, 'dist/worker.js'), "onmessage = event => setTimeout(() => postMessage(event.data.fail ? { error: 'invalid initialization plan' } : { ready: true }), 0);");
  const server = await startServer(resolve(root, 'dist'));
  try {
    for (const engine of ['chromium', 'webkit'] as const) await t.test(engine, async () => {
      const browser = await (engine === 'chromium' ? chromium : webkit).launch({ headless: true });
      try {
        async function recordProtocol(name: string, failed: boolean) {
          const context = await browser.newContext({ viewport: { width: 800, height: 600 } }), page = await context.newPage();
          try {
            await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
            await page.clock.pauseAt(new Date('2026-01-01'));
            await page.addInitScript(value => { Reflect.set(window, '__journeyProtocolFailure', value); }, failed);
            const trace = parseTrace({ schema: 'cssearth-journey@1', journey: 'worker-protocol', profile: engine, toolchain: {}, exercises: ['fixture:worker-protocol'],
              observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
            const record = await recorder(page, trace, server.origin, resolve(root, engine, name), engine, { scheduleWorkers: true });
            await journeyApi(page, server.origin, record).load('/milky-way/', 'ready'); await record.save();
          } finally { await context.close(); }
        }
        await recordProtocol('base', false); await recordProtocol('control', false); await recordProtocol('failure', true);
        assert.deepEqual(await compareDirectories(resolve(root, engine, 'base'), resolve(root, engine, 'control')), []);
        const differences = await compareDirectories(resolve(root, engine, 'base'), resolve(root, engine, 'failure'));
        assert.deepEqual([...new Set(differences.map(row => row.family))], ['errors']);
      } finally { await browser.close(); }
    });
  } finally { await server.close(); }
});
