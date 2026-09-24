import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { implementationPins } from './implementation.ts';

test('cache identity includes transitive numerical owners and leaves no build output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-implementation-'));
  try {
    await writeFile(join(root, 'entry.ts'), "export { value } from './numeric.ts';\n");
    await writeFile(join(root, 'numeric.ts'), 'export const value = 1;\n');
    const before = await implementationPins(root, ['entry.ts']);
    assert.deepEqual(before.map(pin => pin.path), ['entry.ts', 'numeric.ts']);
    await writeFile(join(root, 'numeric.ts'), 'export const value = 2;\n');
    const after = await implementationPins(root, ['entry.ts']);
    assert.equal(before[0]!.sha256, after[0]!.sha256);
    assert.notEqual(before[1]!.sha256, after[1]!.sha256);
    const { readdir } = await import('node:fs/promises');
    assert.deepEqual((await readdir(root)).sort(), ['entry.ts', 'numeric.ts']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('relocated preparation entry points pin their live package owners', async () => {
  const entries = [
    'server/workflows/sampled-prior/compile.ts', 'server/routes/shape-cloud.ts',
    ...['prepare-master', 'prepare-observation-structures', 'prepare-observation-geometry',
      'prepare-filled', 'prepare-coherent', 'prepare-structures', 'prepare-nebula-structures'].map(name => `cli/commands/${name}.ts`),
  ].map(path => `labs/nebula/packages/lab/src/${path}`);
  const pins = await implementationPins(process.cwd(), entries);
  for (const entry of entries) assert.ok(pins.some(pin => pin.path === entry));
  assert.ok(pins.some(pin => pin.path === 'labs/nebula/packages/reconstruction/src/methods/sampled/material-fit.ts'));
  assert.ok(pins.some(pin => pin.path === 'labs/nebula/packages/volume-core/src/fields/authored-shapes.ts'));
  assert.ok(pins.some(pin => pin.path === 'labs/nebula/packages/volume-bake/src/slices/painted-field.ts'));
  assert.equal(pins.some(pin => pin.path.startsWith('labs/nebula/src/')), false);
  // The shared FITS reader the sampled compiler decodes with is pinned by its sources.
  for (const path of ['packages/fits/package.json', 'packages/fits/src/fits.ts', 'packages/fits/src/transport.ts'])
    assert.ok(pins.some(pin => pin.path === path), path);
});

test('sampled supplementary owner allowlist points at existing implementation files', async () => {
  const { sampledImplementationOwners } = await import('../../features/sampled-prior/ownership.ts');
  const { stat } = await import('node:fs/promises');
  for (const path of sampledImplementationOwners) assert.ok((await stat(join(process.cwd(), path))).isFile(), path);
});
