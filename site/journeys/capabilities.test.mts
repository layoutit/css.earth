/** Deleting the journey's first native Tab must make its visible-focus witness red in both engines. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { journeys } from './capabilities.journey.mts';
import { journeyApi } from './harness/api.mts';
import { recorder } from './harness/recorder.mts';
import { startServer } from './harness/server.mts';
import { parseTrace } from './harness/trace.mts';

for (const engine of ['chromium', 'webkit'] as const) test(`${engine}: deleting native Tab makes the visible-focus witness red`,
  { skip: !process.env.JOURNEY_CAPABILITIES_DIST, timeout: 180000 }, async () => {
    const journey = journeys.find(row => row.id === 'capabilities-tab-focus');
    assert.ok(journey);
    const dist = process.env.JOURNEY_CAPABILITIES_DIST;
    assert.ok(dist, 'Set JOURNEY_CAPABILITIES_DIST to the read-only observed distribution');
    const action = "await api.input('keydown', () => api.page.keyboard.press('Tab'));";
    const source = String(journey.run);
    assert.ok(source.includes(action), 'Mutation must delete the real journey action');
    const changed = source.replace(action, 'await api.frames(1, true);').replace(/^async run/u, 'async function');
    // The mutation evaluates only this self-contained journey recipe, never copied application code.
    const removed: unknown = Function(`return (${changed});`)();
    if (typeof removed !== 'function') throw new Error('Invalid journey action mutation');
    const folder = await mkdtemp(resolve('output/tmp/capabilities-test-'));
    const server = await startServer(dist, process.cwd());
    const browser = await (engine === 'chromium' ? chromium : webkit).launch({ headless: true });
    try {
      for (const deleted of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', serviceWorkers: 'block' });
        try {
          const page = await context.newPage();
          await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
          await page.clock.pauseAt(new Date('2026-01-01T00:00:00.000Z'));
          const trace = parseTrace({ schema: 'cssearth-journey@1', journey: journey.id, profile: `${engine}-desktop`,
            toolchain: {}, exercises: journey.exercises, observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
          const record = await recorder(page, trace, server.origin, resolve(folder, deleted ? 'deleted' : 'control'), engine, { scheduleWorkers: true });
          const api = journeyApi(page, server.origin, record);
          if (deleted) {
            const result: unknown = Reflect.apply(removed, undefined, [api]);
            if (!(result instanceof Promise)) throw new Error('Mutation did not run asynchronously');
            await assert.rejects(result, /Native Tab did not focus a visible control/u);
          } else await journey.run(api);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); await server.close(); await rm(folder, { recursive: true, force: true }); }
  });
