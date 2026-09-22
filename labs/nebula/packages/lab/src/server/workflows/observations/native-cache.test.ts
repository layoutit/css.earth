import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import sharp from 'sharp';
import { nativeRemovalTimeoutMs, nativeStarless } from '../emission-inference/native-source.ts';

test('full published native grids receive a larger bounded work budget than small previews', () => {
  const preview = nativeRemovalTimeoutMs([512, 512]), native = nativeRemovalTimeoutMs([23000, 23000]);
  assert.ok(preview >= 300_000);
  assert.ok(native > preview * 10);
  assert.ok(native < 12 * 60 * 60 * 1000);
});

test('alignment-only missing or invalid receipt cannot launch NOX or create a worker request', async () => {
  const cache = resolve('.local/nebula-lab');
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(resolve(cache, 'native-readonly-test-'));
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  try {
    const model = Buffer.from('deliberately not a neural network; this test must never invoke inference');
    const modelPath = resolve(directory, 'model.pb'), output = resolve(directory, 'native');
    await writeFile(modelPath, model);
    const source = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#222222' } }).png().toBuffer();
    await assert.rejects(nativeStarless(source, [16, 8], { directory: relative(process.cwd(), output),
      model: { path: modelPath } }), /source dimensions differ/);
    await assert.rejects(stat(resolve(output, 'request.json')), { code: 'ENOENT' });
    await assert.rejects(nativeStarless(source, [8, 8], { directory: relative(process.cwd(), output),
      model: { path: modelPath } }, { allowProcessing: false }), /cannot start NOX/);
    await assert.rejects(stat(resolve(output, 'request.json')), { code: 'ENOENT' });
    await writeFile(resolve(output, 'result.json'), JSON.stringify({ schema: 'cssearth-nox-output@1', operation: 'apply', sourceSha256: 'wrong-source' }));
    await assert.rejects(nativeStarless(source, [8, 8], { directory: relative(process.cwd(), output),
      model: { path: modelPath } }, { allowProcessing: false }), /does not match/);
    await assert.rejects(stat(resolve(output, 'request.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
