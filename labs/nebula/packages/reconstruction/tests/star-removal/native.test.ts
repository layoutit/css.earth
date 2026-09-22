import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { decodeNativeDiffuse, prepareNativePreservation, prepareNativeRemovalSource, runNativeRemoval, type NativeRemovalRequest } from '../../src/star-removal/native.ts';

test('native image helpers preserve source pixels and positive accounting without a model', async () => {
  const pixels = Buffer.from([3, 40, 200, 100, 5, 9]);
  const source = await sharp(pixels, { raw: { width: 2, height: 1, channels: 3 } }).png().toBuffer();
  const working = await prepareNativeRemovalSource(source, [2, 1]);
  assert.deepEqual(await decodeNativeDiffuse(working, [2, 1]), pixels);
  const kept = await prepareNativePreservation(source, [2, 1]);
  assert.deepEqual(kept.expectedDiffuse, working);
  assert.deepEqual(await decodeNativeDiffuse(kept.expectedStars, [2, 1]), Buffer.alloc(6));
  await assert.rejects(prepareNativeRemovalSource(source, [3, 1]), /dimensions differ/);
});

test('configured worker gets its exact request and reports process failure without running NOX', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nebula-worker-'));
  try {
    const script = join(directory, 'worker.ts'), result = join(directory, 'request.json');
    await writeFile(script, "import {writeFileSync} from 'node:fs';let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{const r=JSON.parse(s);writeFileSync(r.outputDirectory+'/request.json',s);process.exit(r.model.path==='fail'?2:0);});");
    const request: NativeRemovalRequest = { schema: 'cssearth-star-removal@1', operation: 'apply',
      source: { path: '/source', sha256: 'a'.repeat(64), nativeDimensions: [2, 1] },
      model: { path: '/model' }, outputDirectory: directory };
    const execution = { executable: process.execPath, script, cwd: directory };
    await runNativeRemoval(request, execution);
    assert.deepEqual(JSON.parse(await readFile(result, 'utf8')), request);
    await assert.rejects(runNativeRemoval({ ...request, model: { ...request.model, path: 'fail' } }, execution), /NOX stopped: 2/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
