import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolve } from 'node:path';
import { build } from 'vite';

// Build the actual common runtime and its reachable code. A development guard
// that still ships DOM snapshots or diagnostic observers fails this check.
test('production runtime removes development observations from the executable closure', async () => {
  async function bundle(mode: 'development' | 'production' | 'performance') {
    const result = await build({ configFile: false, logLevel: 'silent',
      define: { 'import.meta.env.PROD': JSON.stringify(mode !== 'development'), 'import.meta.env.MODE': JSON.stringify(mode) },
      build: { write: false, minify: 'esbuild', lib: { entry: resolve('src/renderers/css/runtime/object-runtime.ts'), formats: ['es'] },
        rollupOptions: { external: ['@layoutit/polycss'] } } });
    return (Array.isArray(result) ? result : [result]).flatMap(bundle => {
      assert.ok("output" in bundle, "A one-shot build returns generated chunks");
      return bundle.output;
    })
      .filter(item => item.type === 'chunk').map(item => item.code).join('\n');
  }
  const dev = await bundle('development'), production = await bundle('production'), performance = await bundle('performance');
  for (const marker of ['assertStableDomIdentity', 'retainedInitialNodeCount', 'retainedInteractiveImageCount']) {
    assert.ok(dev.includes(marker), `Development observation ${marker} is present in the actual build`);
    assert.ok(performance.includes(marker), `Performance builds retain ${marker} for explicit instrumentation`);
    assert.ok(!production.includes(marker), `Production removes ${marker} and its observation work`);
  }
  assert.ok(production.includes('Object runtime identity does not match'), 'The actual mount remains in the production closure');
});
