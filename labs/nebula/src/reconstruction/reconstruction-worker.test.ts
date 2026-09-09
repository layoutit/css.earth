import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createAlignedObservationMapping } from './reconstruction-geometry.js';
import { prepareReconstruction, RECONSTRUCTION_SETTINGS, chooseReconstructionSampling } from './reconstruction-worker.js';
import { validateCoherentAxisSampling } from './coherent-validation.js';
import { defaultOverlayPlacement } from '../alignment/overlay-placement.js';
import { prepareOverlayGeometry } from '../alignment/overlay-geometry.js';
import { sha256 } from '../../../../src/preparation/volume/source.js';
import { parseCloudCatalogue, createCloudInspection } from '../viewer/cloud-inspection.js';
const close=(a:readonly number[],b:readonly number[])=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-10,`${n} != ${b[i]}`));

test('integration preflight increases real numerical resolution, preserves the gate, and fails at the bound',()=>{
  const verify=(count:number)=>validateCoherentAxisSampling({sampler:{sample(x,_y,_z,out){
    const signal=100*Math.exp(-(((x-.0137)/.0015)**2));out[0]=out[1]=out[2]=signal;
  }},bounds:{min:[-1,-1,-1],max:[1,1,1]},samples:{x:48*count,y:48*count,z:96*count},exposureGain:1});
  assert.throws(()=>verify(8),/quadrature has not converged/);
  const selected=chooseReconstructionSampling(8,verify);
  assert.ok(selected.samplesPerSlab>8);assert.ok(selected.samplesPerSlab<=32);
  assert.ok(selected.validation.x.maximumDisplayDifference<=.008);
  assert.equal(selected.attempts.at(-1)!.samplesPerSlab,selected.samplesPerSlab);
  assert.throws(()=>chooseReconstructionSampling(8,()=>{throw new Error('x quadrature has not converged: .02');}),/within32/);
  assert.throws(()=>chooseReconstructionSampling(8,()=>{throw new Error('Unrelated source corruption');}),/source corruption/);
});

test('actual prepared candidate matrices preserve Alignment CSS axes, pivot, all rotations and observer depth',async()=>{
  const catalogue=JSON.parse(await readFile('labs/nebula/models/lmc/candidates/overlays.json','utf8'));
  for(const id of ['vista-infrared','horalek-widefield','wise-wide-infrared']) {
    const overlay=catalogue.overlays.find((row:{id:string})=>row.id===id);assert.ok(overlay);
    const placement={...overlay.initialPlacement,x:1.3,y:-2.1,z:3.4,rotationX:13,rotationY:-7};
    const mapping=createAlignedObservationMapping({...overlay,placement},catalogue.frame);
    const m=overlay.style.transform.slice(9,-1).split(',').map(Number);
    for(const [u,v] of [[0,0],[1,0],[1,1],[0,1],[.13,.81],[.63,.27]]) {
      const x=u*overlay.widthPx,y=v*overlay.heightPx,d=m[3]*x+m[7]*y+m[15];
      let p=[0,1,2].map(i=>(m[i]*x+m[i+4]*y+m[i+12])/d-overlay.pivotCssPx[i]);
      p=p.map(n=>n*placement.scale);
      // Independent point-wise CSS rotateX, rotateY, rotateZ; the worker instead transforms homogeneous columns.
      for(const [axis,degrees] of [[0,placement.rotationX],[1,placement.rotationY],[2,placement.rotationZ]]) {
        const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),[x,y,z]=p;
        p=axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];
      }
      p=p.map((n,i)=>n+overlay.pivotCssPx[i]+[placement.x,placement.y,placement.z][i]*50);
      const physical=[p[1]/50,p[0]/50,p[2]/50],f=1+physical[2]/mapping.distanceUnits;
      const expected=[physical[0]/f,physical[1]/f];close(mapping.tangentAtUv(u,v),expected);close(mapping.uvAtTangent(...expected as [number,number])!,[u,v]);
      assert.ok(Math.hypot(expected[0]-p[0]/50/f,expected[1]-p[1]/50/f)>.001,'A missing XY swap must fail.');
    }
    const wrong=createAlignedObservationMapping({...overlay,placement:{...placement,scale:placement.scale*.5}},catalogue.frame);
    assert.ok(Math.hypot(...wrong.tangentAtUv(.1,.8).map((n,i)=>n-mapping.tangentAtUv(.1,.8)[i]))>.1);
    assert.throws(()=>createAlignedObservationMapping({...overlay,placement:{...placement,z:-1000}},catalogue.frame),/observer/);
  }
});

test('tiny offline bake retains every light channel, writes pinned XYZ resources and working all-light inspection',async()=>{
  assert.deepEqual([RECONSTRUCTION_SETTINGS.analysisWidth,RECONSTRUCTION_SETTINGS.masterWidth,RECONSTRUCTION_SETTINGS.deliveryWidth],[512,512,512]);
  assert.deepEqual(RECONSTRUCTION_SETTINGS.sliceCounts,{x:48,y:48,z:96});
  const root=process.cwd(),directory=resolve(root,'.local/nebula-lab/reconstruction-test-'+randomUUID());
  await mkdir(directory,{recursive:true});
  try {
    const pixels=Buffer.alloc(32*32*3);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const v=40+Math.round(70*Math.exp(-((x-15)**2+(y-18)**2)/40));pixels.set([v,v-10,25],3*(y*32+x));}
    const photo=await sharp(pixels,{raw:{width:32,height:32,channels:3}}).png().toBuffer();
    const {writeFile}=await import('node:fs/promises');await writeFile(resolve(directory,'source.png'),photo);
    const frame=JSON.parse(await readFile('labs/nebula/models/lmc/particles/object.json','utf8')).properties.volume;
    const geometry=prepareOverlayGeometry([[-2,2,0],[2,2,0],[2,-2,0],[-2,-2,0]],32,32);
    const priorPath='labs/nebula/models/lmc/full-density/source/volume.json',priorBytes=await readFile(priorPath);
    const work={schema:'cssearth-nebula-reconstruction-work@1' as const,id:'reconstruction-'+'a'.repeat(64),imageId:'synthetic',name:'Synthetic native test',
      outputDirectory:resolve(directory,'output'),source:{path:relative(root,resolve(directory,'source.png')),sha256:sha256(photo),width:32,height:32},
      original:{path:relative(root,resolve(directory,'source.png')),sha256:sha256(photo),removalResultId:'synthetic'},
      overlay:{widthPx:32,heightPx:32,transform:`matrix3d(${geometry.matrix})`,pivotCssPx:[0,0,0],placement:defaultOverlayPlacement()},frame,
      stellarPrior:{path:priorPath,sha256:sha256(priorBytes)},sourcePageUrl:'https://example.invalid/synthetic',credit:'Generated fixture'};
    const settings={...RECONSTRUCTION_SETTINGS,analysisWidth:16,masterWidth:16,deliveryWidth:16,sliceCounts:{x:4,y:4,z:8},samplesPerSlab:32,
      priorDimensions:[8,8,32] as [number,number,number],decomposition:{...RECONSTRUCTION_SETTINGS.decomposition,compactRadius:1,extendedRadii:[2,4]},
      depth:{...RECONSTRUCTION_SETTINGS.depth,compactMinimumHalfThicknessKpc:1,extendedMinimumHalfThicknessKpc:1,diffuseHalfThicknessKpc:1}};
    const events:string[]=[];const result=await prepareReconstruction(work,{settings,onProgress:p=>events.push(p.stage)});
    assert.equal(result.type,'complete');assert.ok(events.includes('slices'));assert.equal(events.at(-1),'complete');
    const provenance=JSON.parse(await readFile(resolve(work.outputDirectory,'source/provenance.json'),'utf8'));
    const slices=JSON.parse(await readFile(resolve(work.outputDirectory,'prepared/volume-slices.json'),'utf8'));
    assert.equal(slices.approximation.samplesPerSlab,provenance.validation.integrationSelection.samplesPerSlab);
    assert.equal(slices.approximation.samplesPerSlab,provenance.settings.samplesPerSlab);
    assert.deepEqual(provenance.volume.channels,{compact:true,diffuse:true,extended:true});assert.equal(provenance.stellarPrior.unchanged,true);
    const sums=provenance.decomposition;assert.ok(Math.abs(sums.inputSum-sums.compactSum-sums.extendedSum-sums.diffuseSum)<1e-4);
    const descriptor=JSON.parse(await readFile(resolve(work.outputDirectory,'object.json'),'utf8'));
    assert.equal(sha256(await readFile(resolve(work.outputDirectory,descriptor.prepared.url))),descriptor.prepared.sha256);
    const prepared=JSON.parse(await readFile(resolve(work.outputDirectory,'prepared/inspection.json'),'utf8'));
    const leaves=prepared.data.stacks.flatMap((s:{leaves:{id:string}[]})=>s.leaves.map(l=>l.id));
    const catalogue=parseCloudCatalogue(JSON.parse(await readFile(resolve(work.outputDirectory,'source/cloud-parts.json'),'utf8')),work.id,leaves);
    const inspection=createCloudInspection(catalogue);assert.equal(leaves.filter((id:string)=>inspection.includes(id)).length,16);
    inspection.setSelection([]);assert.equal(leaves.filter((id:string)=>inspection.includes(id)).length,0);
    for(const resource of prepared.data.resources){const bytes=await readFile(resolve(work.outputDirectory,'prepared',resource.path));assert.equal(sha256(bytes),resource.sha256);}
    assert.equal(sha256(await readFile(resolve(directory,'source.png'))),sha256(photo));
    await assert.rejects(()=>prepareReconstruction(work,{settings}),/overwrite/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
