import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { mapRadius, ringRayOccluded, parseRadialLayerRecipe, prepareGiantLayers, rasterAnnularField } from './index.mts';

const recipe = () => ({schema:'cssearth-radial-layer-recipe@1',units:'kilometers',sources:[],layers:[{
  kind:'annular-field',size:9,densities:[1],output:'hypothetical-ring{suffix}.webp',encoding:{lossless:true},
  outerRadius:4,mapping:{kind:'linear',scale:1},grid:{centerInset:1,sampleOffset:0,marginPixels:0,scaleOrder:'divide-multiply'},
  composition:'maximum',alphaUnits:255,maximumAlpha:255,
  bands:[{envelope:'constant',bounds:[2,3],opacity:90,color:[10,20,30]}],
}]});

test('annular preparation is driven by physical band data for an unregistered body', () => {
  const input = parseRadialLayerRecipe(recipe());
  const pixels = rasterAnnularField(input.layers[0],9);
  const pixel = (x,y) => [...pixels.subarray((y*9+x)*4,(y*9+x)*4+4)];
  assert.deepEqual(pixel(4,4),[0,0,0,0]);
  assert.deepEqual(pixel(6,4),[10,20,30,90]);
  assert.deepEqual(pixel(7,4),[10,20,30,90]);
  assert.deepEqual(pixel(8,4),[0,0,0,0]);
  input.layers[0].bands[0].bounds=[1,2];
  assert.equal(rasterAnnularField(input.layers[0],9)[(4*9+7)*4+3],0);
});

test('piecewise logarithmic physical radii preserve authored anchor and inverse values', () => {
  const mapping={kind:'piecewise-log',knots:[[10,1],[100,3],[1000,6]]};
  assert.equal(mapRadius(10,mapping),1);
  assert.equal(mapRadius(100,mapping),3);
  assert.equal(mapRadius(1000,mapping),6);
  for (const radius of [20,90,110,500,1300]) assert.ok(Math.abs(mapRadius(mapRadius(radius,mapping),mapping,true)-radius)<1e-9);
});

test('ring shadow uses the authored oblate body and a forward ray', () => {
  const shadow={direction:[1,0,0],equatorialRadius:2,polarRadius:1};
  assert.equal(ringRayOccluded(-4,0,shadow),true);
  assert.equal(ringRayOccluded(4,0,shadow),false);
  assert.equal(ringRayOccluded(-4,3,shadow),false);
});

test('invalid recipes fail before raster output', () => {
  for (const mutate of [
    input=>input.layers[0].size=Infinity,
    input=>input.layers[0].output='../escaped{suffix}.webp',
    input=>input.layers[0].bands[0].envelope='unimplemented',
    input=>input.layers[0].mapping={kind:'piecewise-log',knots:[[1,1],[2,1]]},
    input=>input.sources.push({path:'../source',expectedBytes:1,expectedSha256:'0'.repeat(64)}),
  ]) { const input=recipe();mutate(input);assert.throws(()=>parseRadialLayerRecipe(input),TypeError); }
});

test('source pin failure leaves the output directory untouched', async () => {
  const directory=await mkdtemp(join(tmpdir(),'cssearth-radial-pin-'));
  try {
    await writeFile(join(directory,'source.txt'),'accepted source');
    const input=recipe();input.sources.push({path:'source.txt',expectedBytes:15,expectedSha256:'0'.repeat(64)});
    await assert.rejects(prepareGiantLayers({sourceDirectory:directory,publicDirectory:join(directory,'output'),config:input}),/pin mismatch/);
    assert.deepEqual(await readdir(directory),['source.txt']);
    input.sources[0].expectedSha256=createHash('sha256').update(await readFile(join(directory,'source.txt'))).digest('hex');
    const result=await prepareGiantLayers({sourceDirectory:directory,publicDirectory:join(directory,'output'),config:input,write:false});
    assert.equal(result.assets.length,1);assert.deepEqual(await readdir(directory),['source.txt']);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
