import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { nativePreserved } from '../emission-inference/native-preserved.ts';
test('preservation keeps compact emission exactly and needs no NOX model or worker', async () => {
  const parent = resolve('.local/nebula-lab/test-preservation'); await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(`${parent}/case-`);
  try {
    const pixels = Buffer.from([0, 1, 255, 254, 25, 3, 1, 128, 7, 240, 255, 255]);
    const source = await sharp(pixels, { raw: { width: 2, height: 2, channels: 3 } }).png().toBuffer();
    await assert.rejects(nativePreserved(source, [2, 2], directory, { allowProcessing: false }), /read-only/);
    const prepared = await nativePreserved(source, [2, 2], directory);
    assert.deepEqual(prepared.pixels, pixels);
    assert.equal(prepared.provenance.stellarTreatment, 'preserve');
    assert.equal(prepared.provenance.accounting.maximumReconstructionErrorCodeValues, 0);
    const residual = await sharp(await readFile(resolve(directory, 'stars.png'))).raw().toBuffer();
    assert.ok(residual.every(value => value === 0));
    assert.deepEqual((await nativePreserved(source, [2, 2], directory, { allowProcessing: false })).pixels, pixels);
    await assert.rejects(readFile(resolve(directory, 'request.json')), /ENOENT/);
    await writeFile(resolve(directory, 'stars.png'), source);
    await assert.rejects(nativePreserved(source, [2, 2], directory, { allowProcessing: false }), /differ from identity/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
