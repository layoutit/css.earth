import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { parseHTML } from 'linkedom';

const calls: string[] = [];
let failing = false;
mock.module(new URL('../scene-imports.mts', import.meta.url).href, { namedExports: {
  async importPackagedObjectRuntime() { calls.push('runtime'); if (failing) throw new Error('import failed'); return { prestartObjectDecoding() { calls.push('decode'); } }; },
  async importSceneRegistry() { calls.push('registry'); return { async loadObject(id: string) { calls.push(`object:${id}`); if (failing) throw new Error('entry failed'); }, async loadSystemView(id: string) { calls.push(`system:${id}`); } }; },
} });
mock.module(new URL('../world-imports.mts', import.meta.url).href, { namedExports: {
  async importApplicationWorld() { calls.push('world'); return { prestartWorldPlanner() { calls.push('planner'); }, async loadApplicationUniverse() { calls.push('universe'); if (failing) throw new Error('world failed'); } }; },
} });
const { startBodyCode, startViewCode } = await import('./startup-boot.mts');
const settle = () => setImmediate();

test('startup code skips absent identities and starts the bound body plus its world independently', async () => {
  calls.length = 0; failing = false;
  for (const markup of ['', '<div class="object-stage"></div>']) {
    const { document } = parseHTML(markup);
    startBodyCode(document); startViewCode(document);
    await settle();
    assert.deepEqual(calls, []);
  }
  const { document } = parseHTML('<div class="object-stage" data-object-id="mars"></div>');
  startBodyCode(document); startViewCode(document);
  await settle();
  assert.deepEqual(calls, ['runtime', 'registry', 'world', 'decode', 'object:mars', 'system:mars', 'planner', 'universe']);
});

test('prestart failures are swallowed and a later caller can start code again', async () => {
  calls.length = 0; failing = true;
  const { document } = parseHTML('<div class="object-stage" data-object-id="moon"></div>');
  startBodyCode(document); startViewCode(document);
  await settle();
  assert.deepEqual(calls, ['runtime', 'registry', 'world', 'object:moon', 'system:moon', 'planner', 'universe']);
  calls.length = 0; failing = false;
  startBodyCode(document);
  await settle();
  assert.deepEqual(calls, ['runtime', 'decode']);
});
