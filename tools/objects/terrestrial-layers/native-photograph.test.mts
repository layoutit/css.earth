import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { writeArrayBuffer } from 'geotiff';
import sharp from 'sharp';
import { loadNativePhotograph, samplePhotographicTexel } from './native-photograph.mts';

const radius = 180 / Math.PI;
const projection = {type:'equirectangular', referenceRadiusMeters:radius, centerLongitude:180,
  longitudeDirection:'east-positive', latitudeType:'planetocentric'};
const pin = (path:string, bytes:Buffer) => ({path, expectedBytes:bytes.length,
  expectedSha256:createHash('sha256').update(bytes).digest('hex'), width:8, height:4, projection});

// Analytic byte grid, with Rhea's unusual 180–540 E extent. Values encode
// source column and row, independently of the production coordinate code.
test('native GeoTIFF follows its origin across both hemispheres and preserves validity', async () => {
  const dir=await mkdtemp(join(tmpdir(),'cssearth-native-photograph-'));
  try {
    const values=Uint8Array.from({length:32},(_,i)=>10+i%8*16+Math.floor(i/8)*8);
    values[0]=1; values[7]=0;
    const bytes=Buffer.from(writeArrayBuffer(values,{width:8,height:4,BitsPerSample:[8],SampleFormat:[1],GDAL_NODATA:'0',
      ModelPixelScale:[45,45,0],ModelTiepoint:[0,0,0,0,90,0],ProjectedCSTypeGeoKey:32767,
      GeoKeyDirectory:[1,1,0,10,
        1024,0,1,1, 1025,0,1,1, 2057,34736,1,0, 2058,34736,1,0,
        3072,0,1,32767, 3075,0,1,17, 3076,0,1,9001,
        3078,34736,1,1, 3088,34736,1,2, 3089,34736,1,1],
      GeoDoubleParams:[radius,0,180]}));
    await writeFile(join(dir,'map.tif'),bytes);
    const source=pin('map.tif',bytes),validity={kind:'geotiff-rgb-alpha',channels:'monochrome',zeroValidity:'all-channels',
      noData:0,centerLongitude:180,resolutionMeters:45};
    const sampler=await loadNativePhotograph(dir,source,validity),rgb=[0,0,0];
    for (const [longitude,latitude,value] of [[202.5,67.5,1],[22.5,67.5,74],[382.5,67.5,74],[-337.5,67.5,74],[0,45,70]]) {
      assert.equal(sampler.sample(longitude,latitude,rgb),true);
      assert.deepEqual(rgb,[value,value,value]);
    }
    assert.equal(sampler.sample(157.5,67.5,rgb),false,'An actual zero is missing');
    assert.equal(sampler.sample(135,67.5,rgb),false,'Every weighted neighbour must be observed');
    assert.equal(sampler.sample(202.5,89,rgb),false,'Do not extrapolate beyond the source pixel centres');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('complete RGB maps retain observed black and wrap their published seam', async () => {
  const dir=await mkdtemp(join(tmpdir(),'cssearth-native-rgb-'));
  try {
    const pixels=Buffer.alloc(8*4*3);
    for(let y=0;y<4;y++)for(let x=0;x<8;x++)pixels.set([x*20,x*10,x*4],(y*8+x)*3);
    const bytes=await sharp(pixels,{raw:{width:8,height:4,channels:3}}).png().toBuffer();
    await writeFile(join(dir,'map.png'),bytes);
    const sampler=await loadNativePhotograph(dir,pin('map.png',bytes),{kind:'image-rgb-no-data',noData:null,centerLongitude:180}),rgb=[0,0,0];
    assert.equal(sampler.sample(22.5,90,rgb),true);assert.deepEqual(rgb,[0,0,0]);
    assert.equal(sampler.sample(0,0,rgb),true);assert.deepEqual(rgb,[70,35,14]);
    assert.equal(sampler.sample(360,0,rgb),true);assert.deepEqual(rgb,[70,35,14]);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('texel footprint preserves the retained CSS axes and withholds an unsupported subsample', () => {
  const points:number[][]=[];
  const sampler={width:8,height:4,sample(longitude:number,latitude:number,color:number[]) {
    points.push([longitude,latitude]);color.fill(longitude+latitude);return true;
  }};
  // CSS (x,y,z) = (u,1,v); body east axis is CSS x, prime-meridian axis CSS y.
  const matrix=[1,0,0,0, 0,0,1,0, 0,0,0,0, 0,1,0,1],rgb=[0,0,0];
  assert.equal(samplePhotographicTexel(sampler,matrix,0,0,1,2,rgb),true);
  const degrees=180/Math.PI;
  const expected=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,z])=>[Math.atan(x)*degrees,Math.atan(z/Math.hypot(1,x))*degrees]);
  for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(points[i][axis]-expected[i][axis])<1e-12);
  assert.ok(Math.abs(rgb[0]-expected.reduce((sum,p)=>sum+p[0]+p[1],0)/4)<1e-12);
  assert.equal(samplePhotographicTexel({...sampler,sample:(lon,lat,c)=>lon<30 && sampler.sample(lon,lat,c)},matrix,0,0,1,2,rgb),false);
});
