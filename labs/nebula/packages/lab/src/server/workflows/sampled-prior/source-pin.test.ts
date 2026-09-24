import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { readSourcePin } from './compile.ts';

test('sampled cache verifies its shared FITS decoder without admitting arbitrary tools', async () => {
  const root = await mkdtemp(join(tmpdir(),'sampled-owner-'));
  try {
    await mkdir(join(root,'packages/fits/src'),{recursive:true});
    const bytes = Buffer.from('fixture decoder');
    await writeFile(join(root,'packages/fits/src/fits.ts'),bytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.deepEqual(await readSourcePin(root,{path:'packages/fits/src/fits.ts'}),bytes);
    await assert.rejects(readSourcePin(root,{path:'tools/fits/fits.mts'}),/ENOENT/);
    await assert.rejects(readSourcePin(root,{path:'tools/other.mts'}),/Invalid sampled source path/);
    await assert.rejects(readSourcePin(root,{path:'packages/core/src/validate.ts'}),/Invalid sampled source path/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
