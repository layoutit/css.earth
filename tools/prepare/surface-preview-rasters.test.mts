import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { unpackSurfacePreview, assertSurfacePreviewCoverage, recipeSurfacePreviews } from './surface-preview-rasters.mts';
import { preparePagedSurfaceMap } from '../objects/paged-ellipsoid/assets.mts';
import { createPagedSurfaceRaster } from '../objects/paged-ellipsoid/surface-raster.mts';
import { prepareProjectiveTextureLayer } from '@cssearth/bake/scene';

// Two reversed bands with conspicuous padding: the preview must recover
// north-to-south rows and must never show a gutter or fill an absent polar row.
test('preview restores reversed, out-of-order bands and preserves missing caps', () => {
  const info = { width: 4, height: 7, channels: 4 as const };
  const data = Buffer.alloc(info.width * info.height * 4, 222);
  const row = (y: number, red: number) => { for (let x = 1; x <= 2; x++) data.set([red, x, 0, 255], (y * 4 + x) * 4); };
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

test('irregular surfaces do not require an ellipsoid or unpack triangle atlases', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-irregular-preview-'));
  try {
    await mkdir(join(directory, 'source/preparation'), { recursive: true });
    await writeFile(join(directory, 'source/preparation/terrestrial.json'), JSON.stringify({
      schema: 'cssearth-terrestrial-preparation@1', geometry: { radialTerrain: { path: 'shape.txt' } },
    }));
    const images = [];
    for await (const image of recipeSurfacePreviews({ objectDirectory: directory,
      publicDirectory: directory, outputDirectory: directory })) images.push(image);
    assert.deepEqual(images, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('paged previews keep the shared cloud composition and raw scientific maps distinct', async () => {
  const directory = await mkdtemp(join(tmpdir(),'cssearth-preview-'));
  try {
    await sharp(Buffer.from([20,40,60]),{raw:{width:1,height:1,channels:3}}).png().toFile(join(directory,'base.png'));
    await sharp(Buffer.from([255,255,255]),{raw:{width:1,height:1,channels:3}}).png().toFile(join(directory,'cloud.png'));
    const config = {surface:{width:1,height:1,quality:90,maps:[],clouds:{path:'cloud.png',maximumAlpha:.5,threshold:0,scale:1,color:[100,120,140]}}};
    const plain = await preparePagedSurfaceMap({config,sourceDirectory:directory,map:{path:'base.png'}});
    const cloudy = await preparePagedSurfaceMap({config,sourceDirectory:directory,map:{path:'base.png',compositeClouds:true}});
    assert.deepEqual([...plain.data],[20,40,60]);
    assert.deepEqual([...cloudy.data],[60,80,100]);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('native photographic maps retain their source grids and defer cloud composition to the atlas sample', async () => {
  const directory = await mkdtemp(join(tmpdir(),'cssearth-native-paged-'));
  try {
    const base = Buffer.from([
      10,20,30, 40,50,60, 70,80,90, 100,110,120,
      130,140,150, 160,170,180, 190,200,210, 220,230,240,
    ]);
    const clouds = Buffer.from([255,255,255, 0,0,0, 255,255,255, 0,0,0]);
    await sharp(base,{raw:{width:4,height:2,channels:3}}).png().toFile(join(directory,'base.png'));
    await sharp(clouds,{raw:{width:2,height:1,channels:3}}).png().toFile(join(directory,'cloud.png'));
    const config = {surface:{width:2,height:1,quality:90,maps:[],clouds:{path:'cloud.png',maximumAlpha:.5,threshold:0,scale:1,color:[100,120,140]}}};
    const prepared = await preparePagedSurfaceMap({config,sourceDirectory:directory,
      map:{path:'base.png',compositeClouds:true,displayGamma:1.25,nativePhotographicSampling:true}});
    assert.deepEqual([prepared.info.width,prepared.info.height,prepared.info.channels],[4,2,3]);
    assert.deepEqual([...prepared.data], [...base], 'gamma remains after native-grid interpolation, before cloud composition');
    assert.ok('nativePhotographicClouds' in prepared);
    assert.deepEqual(prepared.nativePhotographicClouds && [prepared.nativePhotographicClouds.width,prepared.nativePhotographicClouds.height], [2,1]);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('the fixed atlas accepts a larger native photographic grid without changing page dimensions', () => {
  const raster = createPagedSurfaceRaster({publicBase:'/',geometry:{BODY_LONGITUDE_SEGMENTS:1},atlas:{density:2,gutter:0,pageSize:16,pageCells:1,sourceWidth:2}});
  const layer = prepareProjectiveTextureLayer('1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1');
  const cells = [{index:0,size:2,density:1,reversed:false,perspectiveY:0,page:0,x:0,y:0,
    source:{x:0,southY:2,width:2,height:2},layer}];
  const source = Buffer.from([
    0,1,2, 20,21,22, 40,41,42, 60,61,62,
    80,81,82, 100,101,102, 120,121,122, 140,141,142,
  ]);
  const plan = {cells,pages:[{width:16,height:4}]};
  const baked = raster.bakeSurfaceRaster(source,{width:4,height:2,channels:3},plan,2);
  assert.deepEqual([baked.width,baked.height,baked.channels],[16,4,4]);
  assert.deepEqual([...baked.data.subarray(0,4)],[106,107,108,255]);
  const clouded = raster.bakeSurfaceRaster(source,{width:4,height:2,channels:3},plan,2,0,{
    data:Buffer.alloc(2*1*3,255),width:2,height:1,channels:3,
    maximumAlpha:.5,threshold:0,scale:1,color:[200,200,200],
  });
  assert.deepEqual([...clouded.data.subarray(0,4)],[153,154,154,255]);
});

test('surface pages hold neighbouring cells of one row, each at the smallest-area halving of the page', () => {
  const raster = createPagedSurfaceRaster({publicBase:'/earth/',geometry:{BODY_LONGITUDE_SEGMENTS:4},atlas:{density:8,gutter:2,pageSize:64,pageCells:2,sourceWidth:2}});
  // Two rows of four cells: the first row's cells are larger, as near a pole.
  const {positions,pages} = raster.layoutBlockPages([24,24,24,24, 10,10,10,10]);
  assert.deepEqual(positions.map(cell => cell.page), [0,0,1,1, 2,2,3,3]);
  // A tie in area keeps the wider page; the small cells stack two high in a quarter-width page.
  assert.deepEqual(pages, [{width:64,height:28},{width:64,height:28},{width:16,height:28},{width:16,height:28}]);
  for (const [index,cell] of positions.entries()) {
    const size = index < 4 ? 24 : 10;
    assert.ok(cell.x >= 2 && cell.x + size + 2 <= pages[cell.page].width && cell.y + size + 2 <= pages[cell.page].height);
  }
  assert.throws(() => createPagedSurfaceRaster({publicBase:'/earth/',geometry:{BODY_LONGITUDE_SEGMENTS:4},atlas:{density:8,gutter:2,pageSize:64,pageCells:3,sourceWidth:2}})
    .layoutBlockPages([1,1,1,1]), /\/earth\/: atlas.pageCells 3 must divide 4 longitude cells/);
});

test('missing surface previews fail preparation while explicit non-surface views remain valid', () => {
  const controls = [{ id: 'visible' }, { id: 'infrared' }, { id: 'cutaway' }, { id: 'local-overlay' }];
  const bindings = [{ id: 'cutaway', view: 'interior' }, { id: 'local-overlay', overlayId: 'noise' }];
  assert.throws(() => assertSurfacePreviewCoverage(controls, [{ id: 'visible' }], bindings), /Missing prepared surface previews: infrared/);
  assert.doesNotThrow(() => assertSurfacePreviewCoverage(controls, [{ id: 'visible' }, { id: 'infrared' }], bindings));
});

// Native scientific recipes provide their own source-derived minimaps. They
// share the schema with affine recipes but have no affine ellipsoid packing.
test('solid scientific recipes do not enter the affine-only preview fallback', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-solid-preview-'));
  try {
    await mkdir(join(directory, 'source/preparation'), { recursive: true });
    await writeFile(join(directory, 'source/preparation/terrestrial.json'), JSON.stringify({
      schema: 'cssearth-terrestrial-preparation@1', kind: 'solid-observation-body',
      raster: { width: 640, height: 320 },
    }));
    const images = [];
    for await (const image of recipeSurfacePreviews({ objectDirectory: directory,
      publicDirectory: join(directory, 'public'), outputDirectory: join(directory, 'prepared') })) images.push(image);
    assert.deepEqual(images, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
