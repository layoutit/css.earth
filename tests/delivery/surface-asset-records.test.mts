import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { sha256 } from '@cssearth/core/node';
import { verifySurfaceAssetRecords } from '@cssearth/bake/delivery';

test('publication rejects a stale atlas even when the file matches its inventory', async t => {
  const directory=await mkdtemp(join(tmpdir(),'cssearth-surface-records-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const bytes=await sharp({create:{width:8,height:12,channels:4,background:'#888'}}).webp().toBuffer();
  const {writeFile}=await import('node:fs/promises');
  await writeFile(join(directory,'surface.webp'),bytes);
  // The inventory entry carries the R2 content address; the surface record names the file by its URL, size and dimensions.
  const asset={filename:'surface.webp',bytes:bytes.length,sha256:sha256(bytes)};
  const surface={url:'/scenes/fixture/surface.webp',bytes:asset.bytes,width:8,height:12};
  const check=(record:unknown)=>verifySurfaceAssetRecords('fixture',{surfaces:[{surface:record}]},{assets:[asset]},directory);
  await check(surface);
  await assert.rejects(check({...surface,bytes:surface.bytes+1}),/record disagrees/);
  await assert.rejects(check({...surface,width:16}),/dimensions disagree/);
});
