import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { build } from 'vite';

// Build the actual common runtime and its reachable code. A development guard
// that still ships DOM snapshots or diagnostic observers fails this check.
test('production runtime removes development observations from the executable closure', async () => {
  async function bundle(dev) {
    const result = await build({ configFile: false, logLevel: 'silent',
      define: { 'import.meta.env.DEV': JSON.stringify(dev) },
      build: { write: false, minify: 'esbuild', lib: { entry: resolve('src/platform/object-runtime.mjs'), formats: ['es'] },
        rollupOptions: { external: ['@layoutit/polycss'] } } });
    return (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output)
      .filter(item => item.type === 'chunk').map(item => item.code).join('\n');
  }
  const dev = await bundle(true), production = await bundle(false);
  for (const marker of ['assertStableDomIdentity', 'retainedInitialNodeCount', 'retainedInteractiveImageCount']) {
    assert.ok(dev.includes(marker), `Development observation ${marker} is present in the actual build`);
    assert.ok(!production.includes(marker), `Production removes ${marker} and its observation work`);
  }
  assert.ok(production.includes('Object runtime identity does not match'), 'The actual mount remains in the production closure');
});
