import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { extractExtendedSource } from '@cssearth/nebula-reconstruction/star-removal/extraction';

test('morphology support rejects isolated field points and retains connected extended emission',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nebula-extraction-')),input=join(root,'source.png'),width=72,height=64,rgb=Buffer.alloc(width*height*3,8);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const d=Math.hypot((x-36)/22,(y-33)/15),glow=Math.max(0,Math.round(95*(1-d)));for(let c=0;c<3;c++)rgb[3*(y*width+x)+c]=8+glow;}
  for(let y=25;y<36;y++)for(let x=39;x<50;x++){const i=3*(y*width+x);rgb[i]=150;rgb[i+1]=45;rgb[i+2]=55;}
  for(const [x,y] of [[3,3],[67,5],[4,59],[68,58]]){const i=3*(y*width+x);rgb[i]=rgb[i+1]=rgb[i+2]=255;}
  await sharp(rgb,{raw:{width,height,channels:3}}).png().toFile(input);
  const receipt=await extractExtendedSource({inputPath:input,outputDirectory:root,id:'fixture',maxPixels:72,medianSize:5,supportPixels:64,thresholdSigma:2.5,bridgeFraction:.025,softEdgeFraction:.02});
  const mask=await sharp(join(root,receipt.outputs.mask)).raw().toBuffer({resolveWithObject:true}),cutout=await sharp(join(root,receipt.outputs.cutout)).raw().ensureAlpha().toBuffer();
  const maskAt=(x:number,y:number)=>mask.data[mask.info.channels*(y*width+x)];
  assert(maskAt(36,33)>100,'main diffuse body is admitted');
  assert(maskAt(44,30)>100,'extended emission knot is retained');
  const center=4*(33*width+36),compositedGray=cutout[center]*cutout[center+3]/255;
  assert(Math.abs(compositedGray-95*maskAt(36,33)/255)<2,'straight RGB and alpha preserve gray-patch brightness on black');
  for(const [x,y] of [[3,3],[67,5],[4,59],[68,58]])assert(cutout[4*(y*width+x)+3]<8,'isolated point source outside morphology is rejected');
  const first=await readFile(join(root,receipt.outputs.mask)),again=await extractExtendedSource({inputPath:input,outputDirectory:root,id:'fixture',maxPixels:72,medianSize:5,supportPixels:64,thresholdSigma:2.5,bridgeFraction:.025,softEdgeFraction:.02});
  assert.deepEqual(await readFile(join(root,again.outputs.mask)),first,'extraction is deterministic');
});

test('native extraction preserves resolution, alpha signal and source pins while omitting unwanted banks',async()=>{
  const root=await mkdtemp(join(tmpdir(),'nebula-native-')),input=join(root,'source.png'),width=96,height=72;
  const rgb=Buffer.alloc(width*height*3,9);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const value=9+Math.max(0,Math.round(130*(1-Math.hypot((x-47)/31,(y-36)/23))));
    for(let c=0;c<3;c++)rgb[3*(y*width+x)+c]=value;
  }
  await sharp(rgb,{raw:{width,height,channels:3}}).png().toFile(input);
  const common={inputPath:input,id:'native',medianSize:5,supportPixels:64,thresholdSigma:2.5};
  const native=await extractExtendedSource({...common,outputDirectory:join(root,'native'),maxPixels:null,outputMode:'diffuse-only'});
  const legacy=await extractExtendedSource({...common,outputDirectory:join(root,'legacy'),maxPixels:96});
  assert.equal(native.width,width);assert.equal(native.height,height);
  assert.equal(native.options.maxPixels,null);assert.equal(native.options.medianSize,5);
  assert.equal(native.source.sha256,createHash('sha256').update(await readFile(input)).digest('hex'));
  assert.equal(native.outputs.cutout,undefined);assert.equal(native.outputs.residual,undefined);
  assert(!(await readdir(join(root,'native'))).some(file=>/cutout|residual/.test(file)));
  for(const name of ['diffuse','mask'] as const){
    const bytes=await readFile(join(root,'native',native.outputs[name]));
    assert.equal(native.outputHashes[native.outputs[name]],createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(bytes,await readFile(join(root,'legacy',legacy.outputs[name])),'histograms preserve this exact signal and support');
  }
  const reduced=await extractExtendedSource({...common,outputDirectory:join(root,'reduced'),maxPixels:48});
  assert.equal(reduced.width,48);assert.equal(reduced.height,36);
  const wide=join(root,'wide.png');await sharp(input).resize(2048,96,{fit:'fill'}).png().toFile(wide);
  const uncapped=await extractExtendedSource({...common,inputPath:wide,outputDirectory:join(root,'wide'),maxPixels:null,outputMode:'diffuse-only'});
  assert.equal(uncapped.width,2048,'native mode bypasses the default1800 pixel ceiling');assert.equal(uncapped.height,96);
  await assert.rejects(extractExtendedSource({...common,outputDirectory:root,maxPixels:null,medianSize:4}),/odd integer/);
});
