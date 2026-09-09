import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { unpackSurfacePreview, assertSurfacePreviewCoverage } from './surface-preview-rasters.mjs';
import { preparePagedSurfaceMap } from './objects/paged-ellipsoid/assets.mjs';

// Two reversed bands with conspicuous padding: the preview must recover
// north-to-south rows and must never show a gutter or fill an absent polar row.
test('preview restores reversed, out-of-order bands and preserves missing caps', () => {
  const info = { width: 4, height: 7, channels: 4 };
  const data = Buffer.alloc(info.width * info.height * 4, 222);
  const row = (y, red) => { for (let x = 1; x <= 2; x++) data.set([red, x, 0, 255], (y * 4 + x) * 4); };
  row(1, 30); row(4, 20); row(5, 10);
  const result = unpackSurfacePreview({ data, info }, { width: 2, height: 5, bands: [{ y: 3, height: 1 }, { y: 1, height: 2 }], gutter: 1 });
  assert.deepEqual(result.info, { width: 2, height: 5, channels: 4 });
  for (const [y, red] of [[1,10],[2,20],[3,30]]) for (let x = 0; x < 2; x++) {
    assert.deepEqual([...result.data.subarray((y * 2 + x) * 4, (y * 2 + x + 1) * 4)], [red,x+1,0,255]);
  }
  assert.deepEqual([...result.data.subarray(0,8)],Array(8).fill(0));
  assert.deepEqual([...result.data.subarray(32)],Array(8).fill(0));
});

test('preview rejects a changed prepared image layout', () => {
  assert.throws(() => unpackSurfacePreview({ data: Buffer.alloc(32), info: { width: 4,height: 2,channels: 4 } },
    { width: 2,height: 2,bandCount: 1,gutter: 1 }), /packing does not match/);
});

test('paged previews keep the shared cloud composition and raw scientific maps distinct', async () => {
  const directory = await mkdtemp(join(tmpdir(),'cssearth-preview-'));
  try {
    await sharp(Buffer.from([20,40,60]),{raw:{width:1,height:1,channels:3}}).png().toFile(join(directory,'base.png'));
    await sharp(Buffer.from([255,255,255]),{raw:{width:1,height:1,channels:3}}).png().toFile(join(directory,'cloud.png'));
    const config = {surface:{width:1,height:1,clouds:{path:'cloud.png',maximumAlpha:.5,threshold:0,scale:1,color:[100,120,140]}}};
    const plain = await preparePagedSurfaceMap({config,sourceDirectory:directory,map:{path:'base.png'}});
    const cloudy = await preparePagedSurfaceMap({config,sourceDirectory:directory,map:{path:'base.png',compositeClouds:true}});
    assert.deepEqual([...plain.data],[20,40,60]);
    assert.deepEqual([...cloudy.data],[60,80,100]);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('missing surface previews fail preparation while explicit non-surface views remain valid', () => {
  const controls = [{ id: 'visible' }, { id: 'infrared' }, { id: 'cutaway' }, { id: 'local-overlay' }];
  const bindings = [{ id: 'cutaway', view: 'interior' }, { id: 'local-overlay', overlayId: 'noise' }];
  assert.throws(() => assertSurfacePreviewCoverage(controls, [{ id: 'visible' }], bindings), /Missing prepared surface previews: infrared/);
  assert.doesNotThrow(() => assertSurfacePreviewCoverage(controls, [{ id: 'visible' }, { id: 'infrared' }], bindings));
});
