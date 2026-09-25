import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { KERNEL_BANK_ROOT, kernelBankRoot, kernelBanks, readPinnedFile, type KernelBankManifestLocation } from './index.js';

test('the kernel banks are the checkout src/spice, found from the package, not from this file', () => {
  assert.equal(KERNEL_BANK_ROOT, fileURLToPath(new URL('../../../../src/spice', import.meta.url)));
  assert.ok(existsSync(join(KERNEL_BANK_ROOT, 'new-horizons', 'manifest.json')));
  assert.equal(kernelBankRoot('new-horizons'), join(KERNEL_BANK_ROOT, 'new-horizons'));
  assert.throws(() => kernelBankRoot('../objects'), /Invalid kernel bank id: \.\.\/objects/);
});

test('a bank opens its manifest through the caller reader, under the identity spice-<set>', async () => {
  const opened: KernelBankManifestLocation[] = [];
  const banks = kernelBanks({ acquireCommand: 'node bank.mts', openManifest: async location => {
    opened.push(location);
    return { manifest: { inputs: [{ path: 'lsk/naif0012.tls', origin: 'https://example.invalid/naif0012.tls' }] }, validatePath: async () => undefined, verify: async () => undefined };
  } });
  await assert.rejects(banks.kernelBankPaths('new-horizons', ['spk/other.bsp']), /Kernel bank new-horizons does not declare spk\/other\.bsp \(src\/spice\/new-horizons\/manifest\.json\)\./);
  assert.deepEqual(opened, [{ objectId: 'spice-new-horizons', objectName: 'new-horizons SPICE kernel bank', sourceRoot: join(KERNEL_BANK_ROOT, 'new-horizons') }]);
  assert.equal(await banks.restoredBankFile('/elsewhere/kernel.bsp'), '/elsewhere/kernel.bsp');
});

test('a pinned file that is present is read without a download', async () => {
  const path = fileURLToPath(new URL('../../package.json', import.meta.url));
  assert.deepEqual(await readPinnedFile(path, 'https://example.invalid/never', 'unused'), await readFile(path));
});
