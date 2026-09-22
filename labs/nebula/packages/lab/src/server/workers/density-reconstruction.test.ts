import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createAlignedObservationMapping } from '@cssearth/volume-core/coordinates/observation-mapping';
import { prepareReconstruction } from './density-reconstruction.ts';
import { defaultOverlayPlacement } from '@cssearth/volume-core/coordinates/overlay-placement';
import { prepareOverlayGeometry } from '../../adapters/renderer/overlay-geometry.ts';
import { sha256 } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { parseCloudCatalogue, createCloudInspection } from '@cssearth/volume-viewer/scene/cloud-inspection';
const close=(a:readonly number[],b:readonly number[])=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-10,`${n} != ${b[i]}`));

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

test('saved Alignment scale and orientation are preserved instead of stripping its fit',async()=>{
  const catalogue=JSON.parse(await readFile('labs/nebula/models/lmc/candidates/overlays.json','utf8'));
  for(const id of ['vista-infrared','horalek-widefield','wise-wide-infrared']) {
    const overlay=catalogue.overlays.find((row:{id:string})=>row.id===id);
    const reference=createAlignedObservationMapping({...overlay,placement:defaultOverlayPlacement()},catalogue.frame);
    const actual=createAlignedObservationMapping({...overlay,placement:overlay.initialPlacement},catalogue.frame);
    const vector=(m:typeof reference)=>m.tangentAtUv(.8,.5).map((v,i)=>v-m.tangentAtUv(.2,.5)[i]);
    const a=vector(actual),b=vector(reference);
    assert.ok(Math.abs(Math.hypot(...a)/Math.hypot(...b)-3)<1e-10,'The saved 300% scale must survive.');
    const angle=Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]);
    assert.ok(Math.abs(Math.cos(angle)-Math.cos(39*Math.PI/180))<1e-10,'The saved rotation must survive.');
  }
});

test('tiny offline bake uses shared density support and writes pinned XYZ resources and cloud inspection',async()=>{
  const root=process.cwd(),directory=resolve(root,'.local/nebula-lab/reconstruction-test-'+randomUUID());
  await mkdir(directory,{recursive:true});
  try {
    const pixels=Buffer.alloc(32*32*3);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const v=40+Math.round(70*Math.exp(-((x-15)**2+(y-18)**2)/40));pixels.set([v,v-10,25],3*(y*32+x));}
    const photo=await sharp(pixels,{raw:{width:32,height:32,channels:3}}).png().toBuffer();
    const {writeFile}=await import('node:fs/promises');await writeFile(resolve(directory,'source.png'),photo);
    const frame=JSON.parse(await readFile('labs/nebula/models/lmc/full-density/object.json','utf8')).properties.volume;
    const geometry=prepareOverlayGeometry([[-2,2,0],[2,2,0],[2,-2,0],[-2,-2,0]],32,32);
    const priorPath='labs/nebula/models/lmc/full-density/source/volume.json',priorBytes=await readFile(priorPath);
    const descriptorPath='labs/nebula/models/lmc/full-density/object.json',slicesPath='labs/nebula/models/lmc/full-density/prepared/volume-slices.json';
    const descriptor=JSON.parse(await readFile(descriptorPath,'utf8'));
    const pin=async(path:string)=>{await readFile(path);return {path};};
    const cloud={descriptor:await pin(descriptorPath),slices:await pin(slicesPath),
      provenance:await pin('labs/nebula/models/lmc/full-density/source/volume.json')};
    const work={schema:'cssearth-nebula-reconstruction-work@1' as const,id:'reconstruction-'+'a'.repeat(64),imageId:'synthetic',name:'Synthetic native test',
      outputDirectory:resolve(directory,'output'),source:{path:relative(root,resolve(directory,'source.png')),width:32,height:32},
      original:{path:relative(root,resolve(directory,'source.png')),removalResultId:'synthetic'},
      overlay:{widthPx:32,heightPx:32,transform:`matrix3d(${geometry.matrix})`,pivotCssPx:[0,0,0],placement:defaultOverlayPlacement()},frame,
      stellarPrior:{path:priorPath},cloud,sourcePageUrl:'https://example.invalid/synthetic',credit:'Generated fixture'};
    const settings={analysisWidth:32,originalWidth:32,quality:92};
    const events:string[]=[];const result=await prepareReconstruction(work,{settings,onProgress:p=>events.push(p.stage)});
    assert.equal(result.type,'complete');assert.ok(events.includes('material'));assert.equal(events.at(-1),'complete');
    const provenance=JSON.parse(await readFile(resolve(work.outputDirectory,'source/provenance.json'),'utf8'));
    const slices=JSON.parse(await readFile(resolve(work.outputDirectory,'prepared/volume-slices.json'),'utf8'));
    const reference=JSON.parse(await readFile(slicesPath,'utf8'));
    assert.equal(provenance.method,'alignment-density-material-v1');
    assert.equal(provenance.qualification.status,'research-baseline');
    assert.equal(provenance.qualification.materialGatePassed,false);
    assert.deepEqual(slices.boundsUnits,descriptor.properties.volume.boundsUnits);
    assert.deepEqual(slices.quads.map((q:any)=>q.vertices),reference.quads.map((q:any)=>q.vertices));
    assert.equal(provenance.validation.sameGeometry,true);assert.equal(provenance.validation.sameAlpha,true);
    const overlay=JSON.parse(await readFile(resolve(work.outputDirectory,'source/original-overlay.json'),'utf8'));
    assert.equal(overlay.overlays.length,1);
    const outputDescriptor=JSON.parse(await readFile(resolve(work.outputDirectory,'object.json'),'utf8'));
    await readFile(resolve(work.outputDirectory,outputDescriptor.prepared.url));
    const prepared=JSON.parse(await readFile(resolve(work.outputDirectory,'prepared/inspection.json'),'utf8'));
    const leaves=prepared.data.stacks.flatMap((s:{leaves:{id:string}[]})=>s.leaves.map(l=>l.id));
    const catalogue=parseCloudCatalogue(JSON.parse(await readFile(resolve(work.outputDirectory,'source/cloud-parts.json'),'utf8')),work.id,leaves);
    // Main now omits lossless-alpha empty slabs. Check the actual pixels instead
    // of requiring invisible render nodes or mirroring the compiler's flag.
    const nonempty:string[]=[];
    for(const quad of slices.quads){
      const alpha=await sharp(resolve(work.outputDirectory,'prepared',quad.texturePath)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
      if(alpha.some(value=>value>0))nonempty.push(quad.id);
    }
    const inspection=createCloudInspection(catalogue);
    assert.ok(nonempty.length>0);
    assert.deepEqual(leaves.filter((id:string)=>inspection.includes(id)).sort(),nonempty.sort());
    inspection.setSelection([]);assert.equal(leaves.filter((id:string)=>inspection.includes(id)).length,0);
    for(const resource of prepared.data.resources){const bytes=await readFile(resolve(work.outputDirectory,'prepared',resource.path));assert.ok(bytes.length>0);}
    assert.equal(sha256(await readFile(resolve(directory,'source.png'))),sha256(photo));
    await assert.rejects(()=>prepareReconstruction(work,{settings}),/overwrite/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
