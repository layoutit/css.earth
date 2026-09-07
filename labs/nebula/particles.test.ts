import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { decodeDensityKtx2 } from '../../src/preparation/volume/source.js';
import { convertParticlesToDensityVolume } from './particles.js';

test('CIC volume retains bounded mass, varies on every axis and applies one fixed color projection',async()=>{
  const root=await mkdtemp(join(tmpdir(),'particle-volume-')),particlePath=join(root,'particles.bin'),records=[[-.6,-.2,-.5,2],[.45,.35,.55,3],[4,0,0,7]],bytes=Buffer.alloc(records.length*16);records.forEach((p,i)=>p.forEach((v,c)=>bytes.writeFloatLE(v,16*i+4*c)));await writeFile(particlePath,bytes);
  const colorPath=join(root,'color.png'),color=Buffer.from([255,0,0,255,0,0,255,255,255,0,0,255,0,0,255,255]);await sharp(color,{raw:{width:2,height:2,channels:4}}).png().toFile(colorPath);
  const receipt=await convertParticlesToDensityVolume({particlePath,outputDirectory:root,dimensions:[16,14,12],boundsKpc:{min:[-1,-1,-1],max:[1,1,1]},smoothingSigmaVoxels:.8,normalizationQuantile:1,encoding:'sqrt-density-unorm8',colorConstraint:{imagePath:colorPath,centerKpc:[0,0,0],rightDirection:[1,0,0],upDirection:[0,1,0],spanKpc:[2,2]}}),grid=decodeDensityKtx2(await readFile(join(root,'density.ktx2')));
  assert.equal(receipt.particles.accepted,2);assert(Math.abs(receipt.particles.depositedMass-5)<1e-9,'smoothing preserves accepted mass');assert(receipt.diagnostics.axisVariation.every(v=>v>.1),'density varies along x, y and z');assert.equal(grid.width,16);assert.equal(grid.height,14);assert.equal(grid.depth,12);
  let red=0,blue=0;for(let i=0;i<grid.encodedRgba.length;i+=4){red+=grid.encodedRgba[i];blue+=grid.encodedRgba[i+2];}assert(red>0&&blue>0,'fixed observational projection constrains voxel color');assert.match(receipt.interpretation.dust,/No dust/);
  assert.equal(receipt.input.bytes,bytes.length);assert.match(receipt.input.sha256,/^[a-f0-9]{64}$/);assert.equal(receipt.input.layout,'float32-le-xyzmass-kpc');assert.equal(receipt.options.smoothingSigmaVoxels,.8);assert.equal(receipt.options.colorConstraint?.imagePath,colorPath);assert.match(receipt.options.colorConstraint?.imageSha256??'',/^[a-f0-9]{64}$/);
  await assert.rejects(()=>convertParticlesToDensityVolume({particlePath,outputDirectory:join(root,'empty'),dimensions:[8,8,8],boundsKpc:{min:[10,10,10],max:[11,11,11]},smoothingSigmaVoxels:0,normalizationQuantile:1,encoding:'linear-density-unorm8'}),/No positive particle mass/);
});
