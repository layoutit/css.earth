import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('neptune');
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

test('source-calibrated colour remains on retained face textures',async()=>{
 const{data,info}=await sharp(fileURLToPath(new URL('../../../../public/scenes/neptune/neptune-surface-normal.webp',import.meta.url))).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const sums=[0,0,0];let count=0;
 for(let y=600;y<920;y++)for(let x=18;x<2898;x++){
  const band=Math.floor(y/72),packedY=band*108+18+y%72,offset=(packedY*info.width+x)*3;
  for(let channel=0;channel<3;channel++)sums[channel]+=data[offset+channel];count++;
 }
 const mean=sums.map(value=>Math.round(value/count));assert.ok(mean.every((value,channel)=>Math.abs(value-[174,220,238][channel])<=1));
});
