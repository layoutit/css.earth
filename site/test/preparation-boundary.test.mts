import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolve, sep } from 'node:path';
import { build } from 'vite';

test('Shared preparation math has no renderer runtime dependency', async () => {
  const entry = resolve('src/platform/math/matrix.mts');
  const directory = resolve('src/platform/math') + sep;
  const result = await build({ configFile: false, logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, formats: ['es'] } } });
  const modules = new Set<string>();
  for (const bundle of Array.isArray(result) ? result : [result]) {
    assert.ok('output' in bundle);
    for (const chunk of bundle.output) if (chunk.type === 'chunk') {
      assert.deepEqual(chunk.imports, [], 'Preparation must not import an external runtime');
      for (const id of chunk.moduleIds) modules.add(id);
    }
  }
  assert.ok(modules.size >= 1, 'Inspect the complete executable closure');
  for (const id of modules) assert.ok(id === entry || id.startsWith(directory), `Unexpected preparation dependency: ${id}`);
});
