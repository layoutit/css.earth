import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {SKY_BASES,skyRay} from '@cssearth/bake/sky';
import type {PreparedVolumeLeaf} from '@cssearth/objects';
import {dilateTransparentRgb} from '../atlas/pack.mts';
import {faceWeights,guardedPixel,type FacePixels} from './seams.mts';
import {extendPreparedFace} from './geometry.mts';
import type {FixedWideResult} from './integrate.mts';
/** Extend the six freshly integrated faces without moving any original painted ray. */
export async function guardPanorama(out:string,native:FixedWideResult):Promise<FixedWideResult>{
 const size=256,gutter=4,texels=size+2*gutter;await mkdir(`${out}/cirrus`,{recursive:true});
 const faces:FacePixels[]=[];
 for(const basis of SKY_BASES){const raw=await sharp(`${out}/cirrus-native/${basis.id}.webp`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(raw.info.width,size);assert.equal(raw.info.height,size);assert.equal(raw.info.channels,4);faces.push({basis,size,rgba:new Uint8Array(raw.data)});}
 const quads:PreparedVolumeLeaf[]=[],resources:FixedWideResult['resources'][number][]=[],details=[];
 for(const [index,basis]of SKY_BASES.entries()){
  const rgba=new Uint8Array(texels*texels*4);
  for(let y=0;y<texels;y++)for(let x=0;x<texels;x++){
   const ray=skyRay(basis,2*(x-gutter+.5)/size-1,1-2*(y-gutter+.5)/size),pixel=guardedPixel(faces,index,ray,gutter);rgba.set(pixel,(y*texels+x)*4);
   if(x===0||y===0||x===texels-1||y===texels-1)assert.equal(pixel[3],0);
   if(x>=gutter&&x<gutter+size&&y>=gutter&&y<gutter+size&&faceWeights(ray,size,gutter)[index]===1){
    const at=((y-gutter)*size+x-gutter)*4,original=faces[index]!.rgba;assert.equal(pixel[3],original[at+3]);if(pixel[3])for(let c=0;c<3;c++)assert.equal(pixel[c],original[at+c]);}
  }
  const expanded=dilateTransparentRgb(rgba,texels),path=`cirrus/${basis.id}.webp`,bytes=await sharp(expanded,{raw:{width:texels,height:texels,channels:4}}).webp({lossless:true,exact:true}).toBuffer();
  await writeFile(`${out}/${path}`,bytes);assert.deepEqual(new Uint8Array(await sharp(bytes).ensureAlpha().raw().toBuffer()),expanded);
  const before=native.quads.find(leaf=>leaf.texturePath===`cirrus-native/${basis.id}.webp`);if(!before)throw Error('Missing integrated face');
  const result=extendPreparedFace(before,path,gutter);quads.push({...result.leaf,id:`cirrus-${basis.id}`});resources.push({path,width:texels,height:texels,bytes:bytes.length});details.push({face:basis.id,maximumNativeRayErrorCssWorld:result.maximumNativeRayErrorCssWorld});
 }
 const partPath=`${out}/wide-part.json`,recordPath=`${out}/wide-record.json`,metadata={...native.metadata,gutter,texels,details};
 await writeFile(partPath,JSON.stringify({quads,resources},null,2)+'\n');await writeFile(recordPath,JSON.stringify(metadata,null,2)+'\n');
 console.log('PLEIADES_CIRRUS_READY');return{count:6,texels,metadata,partPath,recordPath,quads,resources};
}
