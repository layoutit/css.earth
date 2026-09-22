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
  const pins = await packageImplementationPins(process.cwd(), ['@cssearth/volume-core', '@cssearth/volume-bake']);
  assert.ok(pins.length > 30);
  assert.ok(pins.some(pin => pin.path === '@cssearth/volume-bake/src/compact-inputs/compiler.ts'));
  assert.equal(pins.some(pin => pin.path.startsWith('labs/') || pin.path.endsWith('.test.ts')), false);
});
test('missing package-owned inventory is an error, never an empty fingerprint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-missing-inventory-'));
  try {
    const owner = await fixture(root, 'arbitrary');
    await writeFile(join(owner, 'package.json'), JSON.stringify({ name, exports: { './package.json': './package.json' } }));
    await assert.rejects(packageImplementationPins(root, [name]), /Missing implementation inventory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
