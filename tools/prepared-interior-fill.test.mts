import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { interiorFillInset, preparedSurfaceMean } from './prepared-interior-fill.mts';

test('reserves space for the complete antialiased circle, independent of body shape', () => {
  assert(interiorFillInset * (1+4/512) < 1);
});
test('averages active prepared pages together and ignores transparent padding', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-fill-'));
  try {
    const a=join(directory,'a.png'), b=join(directory,'b.png');
    await sharp(Buffer.from([100,20,40,255, 255,255,255,0]), {raw:{width:2,height:1,channels:4}}).png().toFile(a);
    await sharp(Buffer.from([20,60,80,255]), {raw:{width:1,height:1,channels:4}}).png().toFile(b);
    assert.equal(await preparedSurfaceMean([a,b]), 'rgb(60 40 60)');
  } finally { await rm(directory,{recursive:true,force:true}); }
});
