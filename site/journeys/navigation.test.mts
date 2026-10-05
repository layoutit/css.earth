/** Delete actual journey actions: endpoint assertions and observed IDs must go red. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';
import { journeys } from './navigation.journey.mts';
import { journeyApi, type Journey } from './harness/api.mts';
import { startServer } from './harness/server.mts';
import { recorder } from './harness/recorder.mts';
import { profiles } from './harness/profiles.mts';
import { parseEntries } from './harness/reachability.mts';
import { parseWrappers } from './harness/binding-sites.mts';
import { parseTrace, json } from './harness/trace.mts';
import { manifestIds, validateExercises } from './manifest.mts';

test('navigation recipes preserve unique identities and resolve every requested ID', async () => {
  assert.equal(new Set(journeys.map(journey => journey.id)).size, journeys.length);
  validateExercises(journeys, await manifestIds());
});

const dist = process.env.NAVIGATION_DIST;
for (const engine of ['chromium', 'webkit'] as const) test(`native navigation action deletions fail in ${engine}`, {
  skip: !dist, timeout: 180000,
}, async () => {
  if (!dist) throw new Error('Expected the shared read-only production distribution');
  await mkdir('output/plan7/l1b-navigation', { recursive: true });
  const root = await mkdtemp(resolve('output/plan7/l1b-navigation/mutation-'));
  const source = await readFile(new URL('./navigation.journey.mts', import.meta.url), 'utf8');
  const manifest: unknown = JSON.parse(await readFile(new URL('./manifest-entries.json', import.meta.url), 'utf8'));
  const entries = parseEntries(manifest), wrappers = parseWrappers(manifest);
  const cases = [
    { id: 'navigation-programmatic-submit', remove: 'form.requestSubmit();',
      replace: 'void form;', missing: 'handler:site:object-browser:createObjectBrowserController:submit:1', error: /Form submit did not restore/u },
    { id: 'navigation-view-input', remove: 'await api.page.mouse.move(x + step * 8, y + step * 2);',
      replace: 'void step;', missing: 'handler:site:view-url-runtime:bindViewUrl:objectmotionchange:1', error: /did not publish the changed camera/u },
    { id: 'navigation-world-intent', remove: 'await api.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);',
      replace: 'void box;', missing: 'handler:site:navigation:navigation-fragments:bindNavigationIntent:objecthoverchange:1', error: /Native pointer did not pick/u },
  ];
  const server = await startServer(dist, process.cwd());
  try {
    const browser = await (engine === 'chromium' ? chromium : webkit).launch({ headless: true });
    try {
    for (const mutation of cases) {
      const original = journeys.find(journey => journey.id === mutation.id);
      assert.ok(original);
      const start = source.indexOf(`id: '${mutation.id}'`);
      const next = source.indexOf("}, {\n  id:", start);
      const end = next < 0 ? source.length : next;
      const recipe = source.slice(start, end);
      assert.equal(recipe.split(mutation.remove).length, 2, 'Deletion must target exactly one action in this recipe');
      const file = resolve(root, mutation.id + '.mts');
      await writeFile(file, (source.slice(0, start) + recipe.replace(mutation.remove, mutation.replace) + source.slice(end))
        .replace("'./harness/api.mts'", JSON.stringify(resolve('site/journeys/harness/api.mts')))
        .replace("'./harness/differ.mts'", JSON.stringify(resolve('site/journeys/harness/differ.mts'))));
      const module: unknown = await import(pathToFileURL(file).href);
      if (!module || typeof module !== 'object' || !('journeys' in module) || !Array.isArray(module.journeys)) throw new Error('Malformed mutation module');
      const candidate: unknown = module.journeys.find((row: unknown) => row && typeof row === 'object' && 'id' in row && row.id === mutation.id);
      if (!candidate || typeof candidate !== 'object' || !('run' in candidate) || typeof candidate.run !== 'function') throw new Error('Missing mutated action recipe');
      const actionRecipe = candidate.run;
      const changed: Journey = { ...original, run: async api => { await Reflect.apply(actionRecipe, candidate, [api]); } };
      for (const [label, journey] of [['control', original], ['deleted', changed]] as const) {
        const profile = profiles[engine + '-desktop'];
        if (!profile) throw new Error('Missing profile');
        const context = await browser.newContext({ ...profile, serviceWorkers: 'block' });
        try {
          const page = await context.newPage();
          await page.clock.install({ time: new Date('2025-12-31T23:59:59.000Z') });
          await page.clock.pauseAt(new Date('2026-01-01T00:00:00.000Z'));
          const trace = parseTrace({ schema: 'cssearth-journey@1', journey: journey.id, profile: engine + '-desktop',
            toolchain: json(profile), exercises: journey.exercises, observed: [],
            observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
          const record = await recorder(page, trace, server.origin, resolve(root, mutation.id, label), engine,
            { scheduleWorkers: true, reachability: { dist, entries, wrappers, checkout: process.cwd() } });
          const action = journey.run(journeyApi(page, server.origin, record));
          if (label === 'control') {
            await action; await record.observed();
            assert.ok(trace.observed?.includes(mutation.missing));
          } else {
            await assert.rejects(action, mutation.error);
            await assert.rejects(record.observed(), /Declared but unobserved/u);
            assert.ok(!trace.observed?.includes(mutation.missing));
          }
          await record.save();
        } finally { await context.close(); }
      }
    }
    } finally { await browser.close(); }
  } finally { await server.close(); await rm(root, { recursive: true, force: true }); }
});
