import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {writeArrayBuffer} from 'geotiff';
import {parseGeoTiffImageRecipe, prepareGeoTiffImage} from '@cssearth/bake/objects/acquisition';
const recipe = (samples = 1) => parseGeoTiffImageRecipe({schema:'cssearth-geotiff-image@1',source:{
  url:'https://example.org/map.tif',productId:'fixture',width:8,height:4,origin:[-180,90],resolution:[45,-45],
  coordinates:'degrees',radius:1000,centerLongitude:0,noData:0,bits:8,sampleFormat:1,samples},output:{width:4,height:2,radius:1000}});
function fixture(values: number[], samples = 1) {
  return new Uint8Array(writeArrayBuffer(new Uint8Array(values),{width:8,height:4,SamplesPerPixel:samples,
    BitsPerSample:Array(samples).fill(8),SampleFormat:Array(samples).fill(1),GDAL_NODATA:'0',
    PhotometricInterpretation:samples===1?1:2,GTModelTypeGeoKey:2,GeographicTypeGeoKey:32767,
    ModelPixelScale:[45,45,0],ModelTiepoint:[0,0,0,-180,90,0],GeoDoubleParams:[1000],
    GeoKeyDirectory:[1,1,0,6,1024,0,1,2,1025,0,1,1,2054,0,1,9102,2057,34736,1,0,2058,34736,1,0,2061,0,1,0]}));
}
test('area means preserve orientation, exclude missing pixels and mark wholly unobserved footprints',async()=>{
  const root=await mkdtemp(join(tmpdir(),'image-check-'));
  try {
    const file=join(root,'map.tif');
    await writeFile(file,fixture([0,0,0,20,40,60,80,100,0,0,40,60,80,100,120,140,
      10,30,50,70,90,110,130,150,50,70,90,110,130,150,170,190]));
    const result=await prepareGeoTiffImage(recipe(),{localPath:file});
    const rgb=await sharp(result.bytes).raw().toBuffer();
    assert.deepEqual(Array.from(rgb).filter((_,i)=>i%3===0),[95,40,70,110,40,80,120,160]);
    assert.equal(result.report.missing,1);assert.equal(result.report.partial,1);
    await assert.rejects(prepareGeoTiffImage({...recipe(),source:{...recipe().source,radius:1001}},{localPath:file}),/grid\/encoding changed/);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('RGB zero in one channel is an observation, and streamed origin recovery produces the same output',async()=>{
  const source=fixture(Array.from({length:32},()=>[0,80,160]).flat(),3);
  let requests=0;
  const result=await prepareGeoTiffImage(recipe(3),{transport:async()=>{
    requests++;return new Response(source,{headers:{'content-length':String(source.length)}});
  }});
  assert.equal(requests,1);assert.equal(result.report.missing,0);
  assert.deepEqual(Array.from(await sharp(result.bytes).raw().toBuffer()),Array.from({length:8},()=>[0,80,160]).flat());
});
test('wrong frames, sample encodings and unbounded downloads fail closed',async()=>{
  assert.throws(()=>parseGeoTiffImageRecipe({...recipe(),source:{...recipe().source,centerLongitude:180}}),/global north-up/);
  assert.throws(()=>parseGeoTiffImageRecipe({...recipe(),source:{...recipe().source,bits:16}}),/byte grid/);
  await assert.rejects(prepareGeoTiffImage(recipe(),{transport:async()=>new Response('bad',{headers:{'content-length':'2'}})}),/Oversized/);
});
test('fractional footprints integrate boundary pixels instead of choosing a nearest sample',async()=>{
  const r=parseGeoTiffImageRecipe({...recipe(),source:{...recipe().source,width:10,height:5,resolution:[36,-36],noData:null}});
  const bytes=new Uint8Array(writeArrayBuffer(new Uint8Array(Array.from({length:50},(_,i)=>i%10*10+Math.floor(i/10)*40)),{
    width:10,height:5,SamplesPerPixel:1,BitsPerSample:[8],SampleFormat:[1],PhotometricInterpretation:1,
    ModelPixelScale:[36,36,0],ModelTiepoint:[0,0,0,-180,90,0],GeoDoubleParams:[1000],
    GeoKeyDirectory:[1,1,0,6,1024,0,1,2,1025,0,1,1,2054,0,1,9102,2057,34736,1,0,2058,34736,1,0,2061,0,1,0]}));
  const result=await prepareGeoTiffImage(r,{transport:async()=>new Response(bytes,{headers:{'content-length':String(bytes.length)}})});
  assert.deepEqual(Array.from(await sharp(result.bytes).raw().toBuffer()).filter((_,i)=>i%3===0),[40,64,90,114,136,160,186,210]);
});
