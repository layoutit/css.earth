import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeArrayBuffer, fromFile } from 'geotiff';
import { resampleGeoreferencedObservation } from './observed-geotiff.mts';
import { readObservation } from './observation-raster.mts';
const test = sourceTest();

const radius = 180 / Math.PI;
const policy = {kind:'geotiff-rgb-alpha', noData:0, centerLongitude:0, channels:'rgb', zeroValidity:'all-channels',
  resampling:'source-georeferenced-bilinear'};
function fixture({width=8,height=4,origin=[-168.75,95],resolution=[45,-45],channels=3}={}) {
  const data=Buffer.alloc(width*height*channels);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<channels;c++)data[(y*width+x)*channels+c]=10+x*16+y*8+c;
  return {source:{data,info:{width,height,channels}},entry:{id:'analytic',width,height,projection:{referenceRadiusMeters:radius}},grid:{origin,resolution}};
}
const reds = (result: {rgb: Uint8Array}): number[] => [...result.rgb].filter((_, i) => i % 3 === 0);

test('fractional source origin maps canonical centres through native coordinates across the meridian',()=>{
  const f=fixture(),r=resampleGeoreferencedObservation(f.source,f.entry,policy,f.grid,4,2);
  // Independently: source x = [4.25,6.25,.25,2.25], y = [11/18,47/18].
  // Source red is the analytic plane 10+16*x+8*y; target centres are 45/135/225/315 E, +/-45 N.
  assert.deepEqual(reds(r),[83,115,19,51,99,131,35,67]);
  assert.deepEqual([...r.missing],Array(8).fill(0));
  assert.deepEqual(r.sourceGeoreference,f.grid);
});

test('every nonzero interpolation contributor must be valid; no-data cannot bleed into supported terrain',()=>{
  const f=fixture();f.source.data.fill(0,(0*8+4)*3,(0*8+4)*3+3);
  const r=resampleGeoreferencedObservation(f.source,f.entry,policy,f.grid,4,2);
  assert.deepEqual([...r.missing],[1,0,0,0,0,0,0,0]);
  assert.deepEqual([...r.rgb.subarray(0,3)],[0,0,0]);
  assert.equal(reds(r)[1],115);
});

test('an exact source centre preserves valid dark values and ignores zero-weight invalid neighbours',()=>{
  const f=fixture({origin:[-157.5,67.5]});
  f.source.data.fill(0);
  for(const [x,y] of [[4,0],[6,0],[0,0],[2,0],[4,2],[6,2],[0,2],[2,2]])f.source.data.fill(1,(y*8+x)*3,(y*8+x)*3+3);
  const r=resampleGeoreferencedObservation(f.source,f.entry,policy,f.grid,4,2);
  assert.deepEqual(reds(r),Array(8).fill(1));assert.deepEqual([...r.missing],Array(8).fill(0));
});

test('partial latitude footprint remains missing near both poles and source synthetic sectors stay withheld',()=>{
  const f=fixture({width:4,height:2,origin:[-180,45],resolution:[90,-45]});
  const r=resampleGeoreferencedObservation(f.source,f.entry,{...policy,withholdLongitudeDegrees:[110,150]},f.grid,4,4);
  assert.deepEqual([...r.missing],[1,1,1,1,0,1,0,0,0,1,0,0,1,1,1,1]);
  assert.equal(r.withheldSyntheticPixels,2);
});

test('a shorter longitude footprint is not stretched or cyclically filled to cover the globe',()=>{
  const f=fixture({origin:[-150,95],resolution:[40,-45]});
  const r=resampleGeoreferencedObservation(f.source,f.entry,policy,f.grid,4,2);
  assert.deepEqual(reds(r),[85,121,0,49,101,137,0,65]);
  assert.deepEqual([...r.missing],[0,0,1,0,0,0,1,0]);
});

test('a source declared to wrap longitude interpolates across its edge meridian instead of leaving a missing column',()=>{
  const f=fixture();
  // Sixteen target columns put one centre at 191.25 E, half a source cell past the last source centre (168.75 E).
  const open=resampleGeoreferencedObservation(f.source,f.entry,policy,f.grid,16,2);
  assert.deepEqual([...open.missing].flatMap((value,index)=>value?[index]:[]),[8,24]);
  const wrapped=resampleGeoreferencedObservation(f.source,f.entry,{...policy,wrapLongitude:true},f.grid,16,2);
  assert.deepEqual([...wrapped.missing],Array(32).fill(0));
  // Independently: half-way between source columns 7 and 0 at y = 11/18 and 47/18 on the plane 10+16*x+8*y.
  assert.deepEqual([reds(wrapped)[8],reds(wrapped)[24]],[71,87]);
  const nearest=resampleGeoreferencedObservation(f.source,f.entry,{...policy,resampling:'source-georeferenced-nearest',wrapLongitude:true},f.grid,16,2);
  assert.deepEqual([...nearest.missing],Array(32).fill(0));
  assert.equal(reds(nearest)[8],18,'the cell past the last column is source column 0, row 1');
});

test('only a source spanning 360 degrees, to within one of its pixels, may declare that it wraps',()=>{
  // 8 cells of 30 degrees cover 240 degrees: 120 degrees short, more than one 45-degree pixel.
  const f=fixture({origin:[-120,95],resolution:[30,-45]});
  assert.throws(()=>resampleGeoreferencedObservation(f.source,f.entry,{...policy,wrapLongitude:true},f.grid,4,2),/span 360/);
});

test('actual masked and legacy monochrome dispatch preserve the same nonintegral GeoTIFF grid',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cssearth-georeferenced-observation-'));
  try {
    const f=fixture({channels:1}),path=join(dir,'map.tif');
    const bytes=writeArrayBuffer(f.source.data,{width:8,height:4,BitsPerSample:[8],SampleFormat:[1],GDAL_NODATA:'0',
      ModelPixelScale:[45,45,0],ModelTiepoint:[0,0,0,-168.75,95,0],
      // Also suppress the writer's implicit WGS84 branch, which rewrites ModelTiepoint.
      ProjectedCSTypeGeoKey:32767,
      // Explicit TIFF tags bypass the writer's incomplete symbolic GeoKey type map.
      // Projected/PixelIsArea; spherical metre equirectangular grid, centred at 0/0.
      GeoKeyDirectory:[1,1,0,10,
        1024,0,1,1, 1025,0,1,1, 2057,34736,1,0, 2058,34736,1,0,
        3072,0,1,32767, 3075,0,1,17, 3076,0,1,9001,
        3078,34736,1,1, 3088,34736,1,1, 3089,34736,1,1],
      GeoDoubleParams:[radius,0]});
    await writeFile(path,Buffer.from(bytes));
    const tiff=await fromFile(path);
    try {
      const image=await tiff.getImage();
      assert.deepEqual(image.getOrigin().slice(0,2),f.grid.origin,'The writer must retain the fractional source origin');
      assert.deepEqual(image.getResolution().slice(0,2),f.grid.resolution);
      assert.deepEqual([...(await image.readRasters())[0]],[...f.source.data],'Native TIFF samples match the analytic fixture');
    } finally {await tiff.close();}
    for(const kind of ['geotiff-rgb-alpha','geotiff-monochrome-alpha']) {
      const r=await readObservation(dir,{...f.entry,path:'map.tif'},{...policy,kind,channels:'monochrome'},4,2);
      assert.deepEqual(reds(r),[83,115,19,51,99,131,35,67]);
      assert.deepEqual([...r.missing],Array(8).fill(0));
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});


test('nearest native cells preserve coarse pixels and missing holes through seam and poles',()=>{
  const f=fixture({width:4,height:2,origin:[0,90],resolution:[90,-90]});
  f.source.data.fill(0,3,6); // missing northern second cell; never borrow its neighbor.
  const r=resampleGeoreferencedObservation(f.source,f.entry,{...policy,resampling:'source-georeferenced-nearest'},f.grid,8,4);
  assert.deepEqual(reds(r),[
    10,10,0,0,42,42,58,58,10,10,0,0,42,42,58,58,
    18,18,34,34,50,50,66,66,18,18,34,34,50,50,66,66,
  ]);
  assert.deepEqual([...r.missing],Array.from({length:32},(_,i)=>i<16 && [2,3].includes(i%8)?1:0));
});


test('nearest cell-boundary ties use the same half-open area for both physical moon radii',()=>{
  for (const radius of [561400,764000]) {
    const step=radius*Math.PI/180, f=fixture({width:360,height:180,origin:[0,90*step],resolution:[step,-step]});
    f.entry.projection.referenceRadiusMeters=radius;
    const r=resampleGeoreferencedObservation(f.source,f.entry,{...policy,resampling:'source-georeferenced-nearest'},f.grid,180,90);
    for(let y=0;y<90;y++)for(let x=0;x<180;x++) {
      const cell=(y*2+1)*360+x*2+1, target=y*180+x;
      assert.deepEqual(r.rgb.subarray(target*3,target*3+3),f.source.data.subarray(cell*3,cell*3+3));
    }
  }
});
