/** Real-bank negative controls: a completed native journey must not pass after its bank disappears. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { journeys, ownedRepresentatives, bankWitness } from './representatives.journey.mts';
import { startServer } from './harness/server.mts';
import { recorder } from './harness/recorder.mts';
import { journeyApi } from './harness/api.mts';
import { parseTrace, json } from './harness/trace.mts';
import { profiles } from './harness/profiles.mts';

const dist = process.env.JOURNEY_TEST_DIST;
test('native representative banks reject missing transport and removed geometry', { skip: !dist, timeout: 180000 }, async () => {
  await mkdir(resolve('output/tmp'), { recursive: true });
  const temporary = await mkdtemp(resolve('output/tmp/representative-test-'));
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = temporary;
  const server = await startServer(dist!);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const representative of ownedRepresentatives) {
      const journey = journeys.find(journey => journey.id === representative.id);
      assert.ok(journey);
      const profile = profiles['chromium-desktop']!;
      const context = await browser.newContext({ ...profile, serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
        await page.clock.pauseAt(new Date('2026-01-01T00:00:00.000Z'));
        const resources = new Set<string>();
        page.on('response', response => { if (response.ok()) resources.add(new URL(response.url()).pathname); });
        const trace = parseTrace({ schema: 'cssearth-journey@1', journey: journey.id, profile: 'chromium-desktop', exercises: [],
          toolchain: { browser: browser.version(), profile: json(profile), node: process.versions.node },
          observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
        const record = await recorder(page, trace, server.origin, resolve(temporary, representative.id), 'chromium', { scheduleWorkers: true });
        await journey.run(journeyApi(page, server.origin, record));
        const dataset = representative.datasets.at(-1)!;
        await bankWitness({ page }, representative, dataset, resources);
        await assert.rejects(bankWitness({ page }, representative, dataset, new Set()), /bank transport did not succeed/u);
        await page.evaluate(id => {
          const selector = id === 'observable-universe' ? '[data-image-mesh="cmb"]' : id === 'abell-1689'
            ? '[data-image-layer-object="abell-1689-layers"]' : id === 'local-group'
              ? '.prepared-galaxy-catalog' : '[data-catalogue-points="dots"]';
          for (const element of document.querySelectorAll(selector)) element.remove();
        }, representative.id);
        await assert.rejects(bankWitness({ page }, representative, dataset, resources), /bank did not publish/u);
      } finally { await context.close(); }
    }
  } finally {
    await browser.close(); await server.close();
    if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous;
    await rm(temporary, { recursive: true, force: true });
  }
});
