import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageImplementationPins } from './package-identity.ts';
const name = '@fixture/volume';
async function fixture(root: string, location: string) {
  const owner = join(root, location);
  await mkdir(join(owner, 'numerics'), { recursive: true });
  await mkdir(join(root, 'node_modules/@fixture'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{}');
  await writeFile(join(owner, 'package.json'), JSON.stringify({ name, exports: { './package.json': './package.json' },
    nebulaImplementation: { directories: ['numerics'], extensions: ['.ts'], excludedSuffixes: ['.test.ts'] } }));
  await writeFile(join(owner, 'numerics/field.ts'), 'export const density = 1;\n');
  await symlink(owner, join(root, 'node_modules/@fixture/volume'), 'dir');
  return owner;
}
test('package identities survive relocation and invalidate changed implementation bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-package-identity-'));
  try {
    await fixture(join(root, 'a'), 'research/packages/volume');
    const second = await fixture(join(root, 'b'), 'vendor/relocated');
    const before = await packageImplementationPins(join(root, 'a'), [name]);
    assert.deepEqual(await packageImplementationPins(join(root, 'b'), [name]), before);
    assert.deepEqual(before.map(pin => pin.path), [name + '/package.json', name + '/numerics/field.ts']);
    await writeFile(join(second, 'numerics/field.ts'), 'export const density = 2;\n');
    assert.notDeepEqual(await packageImplementationPins(join(root, 'b'), [name]), before);
    await rm(join(second, 'numerics'), { recursive: true });
    await assert.rejects(packageImplementationPins(join(root, 'b'), [name]), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('actual bake and core packages expose nonempty package-owned inventories', async () => {
  const pins = await packageImplementationPins(process.cwd(), ['@cssearth/bake']);
  assert.ok(pins.length > 30);
  assert.ok(pins.some(pin => pin.path === '@cssearth/bake/src/volume/contracts/volume-recipe.ts'));
  assert.ok(pins.some(pin => pin.path === '@cssearth/bake/src/volume/node/compact-inputs/compiler.ts'));
  assert.equal(pins.some(pin => pin.path.startsWith('labs/') || pin.path.endsWith('.test.ts')), false);
});
test('the bake inventory covers every bake topic a nebula delivery runs', async () => {
  const { build } = await import('esbuild');
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const root = process.cwd();
  const result = await build({ entryPoints: [resolve(root, 'tools/nebula/application/prepare.ts')], bundle: true, write: false, metafile: true,
    platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'bake-sources', setup(builder) { builder.onResolve({ filter: /^@cssearth\/bake\// }, args =>
      ({ path: resolve(root, 'packages/bake/src', args.path.slice('@cssearth/bake/'.length), 'index.ts') })); } }] });
  const reached = [...new Set(Object.keys(result.metafile.inputs).filter(path => path.startsWith('packages/bake/src/'))
    .map(path => `src/${path.split('/')[3]}`))].sort();
  const manifest = JSON.parse(await readFile(resolve(root, 'packages/bake/package.json'), 'utf8')) as { nebulaImplementation: { directories: string[] } };
  assert.ok(reached.includes('src/volume-leaves') && reached.includes('src/density'), 'the closure reaches the bake through its entries');
  assert.deepEqual(reached.filter(directory => !manifest.nebulaImplementation.directories.includes(directory)), [],
    'every bake topic a delivery runs is in nebulaImplementation.directories');
});
test('missing package-owned inventory is an error, never an empty fingerprint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-missing-inventory-'));
  try {
    const owner = await fixture(root, 'arbitrary');
    await writeFile(join(owner, 'package.json'), JSON.stringify({ name, exports: { './package.json': './package.json' } }));
    await assert.rejects(packageImplementationPins(root, [name]), /Missing implementation inventory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
