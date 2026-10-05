import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mock } from 'node:test';
mock.module(new URL('./scene/scene-router.mts', import.meta.url).href, { namedExports: { marker: 'router' } });
mock.module(new URL('./scene/scene-registry.mts', import.meta.url).href, { namedExports: { marker: 'registry' } });
mock.module(new URL('./packaged-object-runtime.mts', import.meta.url).href, { namedExports: { marker: 'runtime' } });
const { importSceneRouter, importSceneRegistry, importApplicationWorld, importPackagedObjectRuntime } = await import('./shared-imports.mts');
test('shared import promises are reused and deliver the requested module', async () => {
  for (const [load, marker] of [[importSceneRouter, 'router'], [importSceneRegistry, 'registry'], [importApplicationWorld, 'world'], [importPackagedObjectRuntime, 'runtime']] as const) {
    const first = load();
    assert.equal(load(), first);
    const value = await first;
    if (marker === 'world') {
      assert.throws(() => Reflect.get(value, 'createApplicationWorldContext')(), /Router unit tests must inject/);
    } else {
      assert.equal(Reflect.get(value, 'marker'), marker);
    }
    assert.equal(load(), first);
  }
});
