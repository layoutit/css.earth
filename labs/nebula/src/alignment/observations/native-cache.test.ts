import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import sharp from 'sharp';
import { nativeStarless } from '../../reconstruction/emission-inference/native-source.js';

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
    const script = await readFile('labs/nebula/src/star-removal/star-removal.py');
    await assert.rejects(nativeStarless(source, [8, 8], { directory: relative(process.cwd(), output),
      model: { path: modelPath, sha256: sha(model) }, scriptSha256: sha(script) }, { allowProcessing: false }), /cannot start NOX/);
    await assert.rejects(stat(resolve(output, 'request.json')), { code: 'ENOENT' });
    await writeFile(resolve(output, 'result.json'), JSON.stringify({ schema: 'cssearth-nox-output@1', operation: 'apply', sourceSha256: 'wrong-source' }));
    await assert.rejects(nativeStarless(source, [8, 8], { directory: relative(process.cwd(), output),
      model: { path: modelPath, sha256: sha(model) }, scriptSha256: sha(script) }, { allowProcessing: false }), /does not match/);
    await assert.rejects(stat(resolve(output, 'request.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
