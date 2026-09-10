// SPDX-License-Identifier: GPL-2.0-or-later
// Run the native Celestia code, retain its output, then decode triangle strips.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='tools/objects/celestia-comets';
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(`${root}/source/meshes`,{recursive:true});
for(const name of ['asteroid','roughsphere']){
 const cms=await readFile(`${root}/source/${name}.cms`,'utf8');
 const vector=k=>cms.match(new RegExp(`\\b${k}\\s*\\[([^\\]]+)\\]`))[1].trim().split(/\s+/).map(Number);
 const scalar=k=>Number(cms.match(new RegExp(`\\b${k}\\s+([\\d.]+)`))[1]);
 const args=[...vector('Size'),...vector('NoiseOffset'),scalar('FeatureHeight'),scalar('Octaves'),scalar('Rings'),scalar('Slices'),20260909].map(String);
 const run=spawnSync('output/celestia-comets/native/export',args,{encoding:'utf8',maxBuffer:10*1024*1024});
 if(run.status!==0)throw Error(run.stderr||'Native export failed');
 const repeat=spawnSync('output/celestia-comets/native/export',args,{encoding:'utf8',maxBuffer:10*1024*1024});if(repeat.stdout!==run.stdout)throw Error('Native export not deterministic');
 await writeFile(`${root}/source/meshes/${name}.native.json`,run.stdout);
 const raw=JSON.parse(run.stdout),rings=scalar('Rings'),slices=scalar('Slices');
 const min=[0,1,2].map(i=>Math.min(...raw.vertices.map(v=>v[i]))),max=[0,1,2].map(i=>Math.max(...raw.vertices.map(v=>v[i])));
 const center=min.map((v,i)=>Math.fround(Math.fround(v+max[i])*.5)),scale=Math.fround(2/Math.max(...max.map((v,i)=>Math.fround(v-min[i]))));
 // Celestia Model::normalize uses the bounding-box centre and maximum extent.
 // Round native arithmetic to float; [x,-z,y] is a proper rotation Y-up to Z-up.
 const normalized=raw.vertices.map(v=>v.map((n,i)=>Math.fround(Math.fround(n-center[i])*scale))).map(([x,y,z])=>[x,-z,y]);
 const vertices=[],mapping=new Map(),ids=[];let maximumWeldError=0;
 for(let i=0;i<normalized.length;i++){
  const ring=Math.floor(i/(slices+1)),slice=i%(slices+1);
  const key=ring===0?'south':ring===rings-1?'north':`${ring}:${slice%slices}`;
  if(!mapping.has(key)){mapping.set(key,vertices.length);vertices.push(normalized[i]);}
  ids[i]=mapping.get(key);maximumWeldError=Math.max(maximumWeldError,Math.hypot(...normalized[i].map((v,k)=>v-vertices[ids[i]][k])));
 }
 if(maximumWeldError>1e-5)throw Error('Seam/pole weld exceeds native float tolerance');
 const faces=[];let omittedDegenerate=0;
 for(const strip of raw.strips)for(let i=0;i<strip.length-2;i++){
  const face=(i%2?[strip[i+1],strip[i],strip[i+2]]:[strip[i],strip[i+1],strip[i+2]]).map(i=>ids[i]);
  if(new Set(face).size<3){omittedDegenerate++;continue;}faces.push(face);
 }
 const signedVolume=faces.reduce((sum,f)=>{const [a,b,c]=f.map(i=>vertices[i]);return sum+(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;},0);
 if(!(signedVolume>0))throw Error('Native triangle strip winding is not outward');
 const obj='# Celestia native CMS export; GPL-2.0-or-later. See ../upstream.json and ../../native/.\n'+vertices.map(v=>`v ${v.join(' ')}`).join('\n')+'\n'+faces.map(f=>`f ${f.map(i=>i+1).join(' ')}`).join('\n')+'\n';
 await writeFile(`${root}/source/meshes/${name}.obj`,obj);
 const report={source:`${name}.cms`,nativeArguments:args,nativeSha256:hash(run.stdout),objSha256:hash(obj),nativeVertices:raw.vertices.length,vertices:vertices.length,faces:faces.length,omittedDegenerate,normalization:{center,scale,method:'Celestia Model::normalize bounding-box maximum extent'},axisTransform:'[x,-z,y], proper Y-up to Z-up rotation',maximumWeldError,volume:signedVolume,volumeEquivalentRadius:Math.cbrt(3*signedVolume/(4*Math.PI)),repeatNativeExportIdentical:true};
 await writeFile(`${root}/source/meshes/${name}.json`,JSON.stringify(report,null,2)+'\n');console.log(name,report.vertices,report.faces,'weld error',maximumWeldError,'radius',report.volumeEquivalentRadius);
}
