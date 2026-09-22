import {parseFiniteMaterialSettings,verifyFiniteMaterialArtifacts} from './finite-density-material-artifacts.ts';
import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import sharp from 'sharp';
import {recolorCloudSlices} from '@cssearth/volume-bake/slices/material';import {sha256} from '@cssearth/volume-bake/compact-inputs/density-grid';import type {VolumeSlices} from '@cssearth/volume-core/contracts/volume-slices';
test('finite XYZ material repaint preserves geometry and every decoded alpha byte across all banks',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'finite-material-'));
 try{const rgba=Buffer.from([255,255,255,0,255,255,255,64,255,255,255,128,255,255,255,255]);const bytes=await sharp(rgba,{raw:{width:2,height:2,channels:4}}).png().toBuffer();
 const slices:VolumeSlices={boundsUnits:{min:[-1,-1,-1],max:[1,1,1]},provenance:{},approximation:{method:'fixture',radialEmission:'none',limitations:[],samplesPerSlab:2,opticalWeight:1,exposureGain:1,sliceCounts:{x:1,y:1,z:1},slabPitchUnits:{x:2,y:2,z:2}},quads:[]};
 for(const axis of ['x','y','z'] as const)slices.quads.push({id:axis,axis,sliceIndex:0,texturePath:`${axis}.png`,widthPx:2,heightPx:2,vertices:axis==='x'?[[0,-1,1],[0,1,1],[0,1,-1],[0,-1,-1]]:axis==='y'?[[-1,0,1],[1,0,1],[1,0,-1],[-1,0,-1]]:[[-1,1,0],[1,1,0],[1,-1,0],[-1,-1,0]],uvs:[[0,0],[1,0],[1,1],[0,1]],center:[0,0,0],normal:[0,0,1],sha256:sha256(bytes),bytes:bytes.length,alphaCoverage:1});
 const before=structuredClone(slices);const painted=await recolorCloudSlices({slices,loadResource:async()=>bytes,sampleImageRgb:(x,y,z,out)=>{out[0]=128+64*x;out[1]=128+64*y;out[2]=128+64*z;return true;},preserveMaterialIntensity:true,outputDirectory:directory,encoding:{format:'png'}});
 assert.deepEqual(slices,before);assert.deepEqual(painted.slices.quads.map(q=>q.vertices),before.quads.map(q=>q.vertices));
 for(const q of painted.slices.quads){const actual=await sharp(await readFile(join(directory,q.texturePath))).ensureAlpha().raw().toBuffer();for(let i=3;i<rgba.length;i+=4)assert.equal(actual[i],rgba[i]);}
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('explicit settings validation and cached artifact corruption fail closed',async()=>{
 assert.throws(()=>parseFiniteMaterialSettings({width:256,spacing:[0,1,1],origin:[0,0,0],maximumRegions:8192,iterations:150,regularization:.01}));
 assert.equal(parseFiniteMaterialSettings({width:256,spacing:[.2,.2,1],origin:[0,0,0],maximumRegions:8192,iterations:150,regularization:.01}).width,256);
 const directory=await mkdtemp(join(tmpdir(),'finite-cache-'));
 try{await mkdir(join(directory,'prepared'));const bytes=Buffer.from('{}');await writeFile(join(directory,'object.json'),bytes);await writeFile(join(directory,'prepared/volume.json'),bytes);
 const pin={sha256:sha256(bytes),bytes:bytes.length};await writeFile(join(directory,'manifest.json'),JSON.stringify({schema:'cssearth-nebula-reconstruction-artifacts@1',id:'fixture',artifacts:{'object.json':pin,'prepared/volume.json':pin}}));
 await verifyFiniteMaterialArtifacts(directory,'fixture');await writeFile(join(directory,'prepared/volume.json'),'broken');await assert.rejects(verifyFiniteMaterialArtifacts(directory,'fixture'),/byte length mismatch/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
