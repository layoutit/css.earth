import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import sharp from 'sharp';
import {renderRadialSnapshot} from './radial-snapshot.mts';

const normal=[1,0,0];
const faces=[
  [[1,-1,-1],[1,1,-1],[1,1,1]],
  [[1,-1,-1],[1,1,1],[1,-1,1]],
].map(vertices=>({vertices,normal,vertexNormals:[normal,normal,normal]}));
const valid=[231,21,41],missing=[82,84,82];
const options={faces,size:32,longitudeDegrees:0,latitudeDegrees:0,ambient:1,diffuse:0,
  sampleSurface:(point: readonly number[])=>({normal,color:point[1]>=point[2]?valid:missing})};

function assertExactColors(data: Buffer) {
  const seen=new Set();let transparent=0;
  for(let i=0;i<data.length;i+=4){
    assert.ok(data[i+3]===0||data[i+3]===255,'No interpolated valid/missing silhouette alpha');
    if(!data[i+3]){transparent++;continue;}
    const color=data.subarray(i,i+3).join(',');
    assert.ok(color===valid.join(',')||color===missing.join(','),`Interpolated facet color: ${color}`);seen.add(color);
  }
  assert.equal(seen.size,2);assert.ok(transparent>0);
}

test('nearest scientific snapshots preserve adjacent valid/missing facet colors through PNG and final thumbnail WebP',async()=>{
  const png=await renderRadialSnapshot({...options,displaySampling:'nearest'});
  const decoded=await sharp(png).ensureAlpha().raw().toBuffer();assertExactColors(decoded);
  const webp=await sharp(png).resize(16,16,{kernel:'nearest'})
    .extend({left:8,right:8,top:0,bottom:0,background:{r:0,g:0,b:0,alpha:0}}).webp({lossless:true,effort:4}).toBuffer();
  const result=await sharp(webp).ensureAlpha().raw().toBuffer();assertExactColors(result);
  const metadata=await sharp(webp).metadata();assert.deepEqual([metadata.width,metadata.height],[32,16]);
});

test('scientific snapshot interpolation requires the explicit nearest policy',async()=>{
  await assert.rejects(renderRadialSnapshot({...options,displaySampling:'bilinear'}),/Invalid radial snapshot/);
  // The old display path remains available for ordinary photographic snapshots.
  const image=await renderRadialSnapshot(options),metadata=await sharp(image).metadata();
  assert.deepEqual([metadata.width,metadata.height],[32,32]);
});
