import { parseFiniteMaterialSettings, verifyFiniteMaterialArtifacts } from './finite-density-material-artifacts.ts';
/** One offline finite-material experiment on an existing reconstruction. All density slice alpha is retained. */
import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { implementationPins } from '../../server/services/implementation.ts';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';
import { fitFiniteRegionMaterial, type MaterialTransportSample } from '@cssearth/nebula-reconstruction/methods/sampled/finite-region-material';
import { compilerSlabMaterial } from '@cssearth/volume-core/materials/slab-material';
import { recolorCloudSlices } from '@cssearth/volume-bake/slices/material';
import { loadVolumeSource, sampleEncoded, sourceBytes, sha256, containedPath } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { channelDensity } from '@cssearth/volume-bake/slices/density';
import { parseVolumeRecipe, type Vector3 } from '@cssearth/volume-core/contracts/volume-recipe';
import type { VolumeSlices, VolumeSliceQuad } from '@cssearth/volume-core/contracts/volume-slices';
const json=async(path:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,bytes);return sha256(bytes);};
interface DecodedSlice { quad:VolumeSliceQuad; alpha:Uint8Array }
function sampleAlpha(slice:DecodedSlice,x:number,y:number):number {
  const q=slice.quad,origin=q.vertices[0]!,horizontal=q.vertices[1]!,vertical=q.vertices[3]!;
  const u=(x-origin[0])/(horizontal[0]-origin[0]),v=(y-origin[1])/(vertical[1]-origin[1]);
  if(u<0||u>1||v<0||v>1)return 0;
  const gx=Math.max(0,Math.min(q.widthPx-1,u*q.widthPx-.5)),gy=Math.max(0,Math.min(q.heightPx-1,v*q.heightPx-.5));
  const ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;let a=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)a+=slice.alpha[Math.min(q.heightPx-1,iy+dy)*q.widthPx+Math.min(q.widthPx-1,ix+dx)]!*(dx?fx:1-fx)*(dy?fy:1-fy);
  return a/255;
}
export async function finiteDensityMaterial(baselineId:string,settingsPath:string) {
  if(!/^[a-f0-9]{64}$/.test(baselineId))throw Error('Expected an existing reconstruction result hash');
  const root=process.cwd(),baseline=resolve(root,'.local/nebula-lab/reconstructions',baselineId);
  const provenanceBytes=await readFile(resolve(baseline,'source/provenance.json'));
  const oldResultBytes=await readFile(resolve(baseline,'result.json'));
  const provenance=parseLabModelJson(provenanceBytes.toString()),oldResult=parseLabModelJson(oldResultBytes.toString());
  await verifyFiniteMaterialArtifacts(baseline,`reconstruction-${baselineId}`);
  if(provenance.schema!=='cssearth-nebula-reconstruction-provenance@1'||oldResult.resultId!==baselineId||provenance.request.cloud.modelPlacement)throw Error('Expected an unplaced fixed-density reconstruction');
  const work=provenance.request,frame=work.frame;
  const recipe=parseVolumeRecipe(parseLabModelJson((await sourceBytes(root,work.cloud.provenance)).toString()));
  if(recipe.material.emissionTransfer!=='shared-opacity'||recipe.material.absorption.length||recipe.material.emission.length!==1||recipe.material.emission[0].channel!==3)throw Error('Prototype requires scalar shared-opacity density');
  const source=await loadVolumeSource(dirname(resolve(root,work.cloud.provenance.path)),recipe);
  const sourceSlices=parseLabModelJson((await sourceBytes(root,work.cloud.slices)).toString()) as VolumeSlices;
  if(JSON.stringify(sourceSlices.boundsUnits)!==JSON.stringify(recipe.grid.bounds))throw Error('Source frame mismatch');
  const settingsBytes=await readFile(settingsPath),settings=parseFiniteMaterialSettings(JSON.parse(settingsBytes.toString()));
  const pins=await implementationPins(root,['labs/nebula/packages/lab/src/cli/commands/finite-density-material.ts']);
  const identity={baseline:{resultId:baselineId,provenanceSha256:sha256(provenanceBytes),resultSha256:sha256(oldResultBytes)},settings,settingsPin:{path:relative(root,resolve(settingsPath)),sha256:sha256(settingsBytes)},implementation:pins};
  const resultId=sha256(Buffer.from(JSON.stringify(identity))),id=`reconstruction-${resultId}`,output=resolve(root,'.local/nebula-lab/reconstructions',resultId);
  try{await readFile(resolve(output,'result.json'));await verifyFiniteMaterialArtifacts(output,id);console.log(JSON.stringify({resultId,output,cached:true}));return;}catch(error){if(!error||typeof error!=='object'||!('code'in error)||error.code!=='ENOENT')throw error;}
  const previous=await readdir(output).catch(()=>[]);if(previous.length)throw Error('Refusing to overwrite incomplete experiment');
  const bounds=provenance.geometry.tangentBoundsKpc,distance=provenance.geometry.observerDistanceKpc;
  if(!Number.isFinite(distance)||distance<=0||![...bounds.min,...bounds.max].every(Number.isFinite))throw Error('Invalid registered tangent frame');
  const width=settings.width,height=Math.round(width*(bounds.max[1]-bounds.min[1])/(bounds.max[0]-bounds.min[0]));
  const sourceImage=await readFile(resolve(baseline,'source/registered-image.png')),coverageImage=await readFile(resolve(baseline,'source/original-image.png'));
  const image=await sharp(sourceImage).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer();
  const coverage=await sharp(coverageImage).resize(width,height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const target=new Float32Array(width*height*3),covered=new Uint8Array(width*height);
  for(let i=0;i<covered.length;i++){const peak=Math.max(image[3*i]!,image[3*i+1]!,image[3*i+2]!);if(coverage[4*i+3]!<250||peak===0)continue;covered[i]=1;for(let c=0;c<3;c++)target[3*i+c]=image[3*i+c]!/peak;}
  const encoded:[number,number,number,number]=[0,0,0,0];
  const density=(x:number,y:number,z:number)=>{sampleEncoded(source,x,y,z,encoded);return channelDensity(encoded[3],recipe.grid.encoding);};
  const zSlices:DecodedSlice[]=[];
  for(const quad of sourceSlices.quads.filter(q=>q.axis==='z').sort((a,b)=>a.center[2]-b.center[2])){
    const bytes=await sourceBytes(dirname(resolve(root,work.cloud.slices.path)),{path:quad.texturePath});
    const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();zSlices.push({quad,alpha:Uint8Array.from({length:quad.widthPx*quad.heightPx},(_,i)=>raw[4*i+3]!)});
  }
  const raySamples=function*(pixel:number):Generator<MaterialTransportSample>{
    const tx=bounds.min[0]+(pixel%width+.5)/width*(bounds.max[0]-bounds.min[0]);
    const ty=bounds.max[1]-(Math.floor(pixel/width)+.5)/height*(bounds.max[1]-bounds.min[1]);let transmission=1;
    for(const slice of zSlices){const z=slice.quad.center[2],x=tx*(distance+z)/distance,y=ty*(distance+z)/distance,a=sampleAlpha(slice,x,y);if(a<=0)continue;
      const contribution=transmission*a;transmission*=1-a;
      const points:Vector3[]=[],weights:number[]=[];let total=0;
      for(let s=0;s<sourceSlices.approximation.samplesPerSlab;s++){const sz=z+sourceSlices.approximation.slabPitchUnits.z*((s+.5)/sourceSlices.approximation.samplesPerSlab-.5);const point:Vector3=[x,y,sz];points.push(point);const w=density(...point);weights.push(w);total+=w;}
      if(total>0)for(let s=0;s<points.length;s++)yield{point:points[s]!,contribution:contribution*weights[s]!/total};
      else yield{point:[x,y,z],contribution};
    }
  };
  console.log('Fitting finite material regions from immutable Z-bank opacity');
  const material=fitFiniteRegionMaterial({...settings,width,height,target,covered,raySamples});
  await mkdir(output,{recursive:true});await cp(resolve(baseline,'source'),resolve(output,'source'),{recursive:true});await mkdir(resolve(output,'prepared'),{recursive:true});
  const sample=compilerSlabMaterial((x,y,z,out)=>{out[0]=out[1]=out[2]=density(x,y,z);},material.sampleMaterial);
  const painted=await recolorCloudSlices({slices:sourceSlices,loadResource:path=>readFile(containedPath(dirname(resolve(root,work.cloud.slices.path)),path)),
    sampleImageRgb:sample,preserveMaterialIntensity:true,appearance:{saturation:1,detailStrength:0,detailScale:24,brightness:1,gamma:1},
    outputDirectory:resolve(output,'prepared'),encoding:{format:'webp',quality:92},onProgress:p=>{if(p.completed%24===0)console.log(`Material ${p.completed}/${p.total}`);}});
  const receipt={...material.receipt,identity,sourceImages:{registered:sha256(sourceImage),coverage:sha256(coverageImage)},validation:{sameGeometry:true,sameAlpha:true,coverage:painted.coverage},qualification:{status:'research-experiment',materialGatePassed:false,reason:'Finite region prototype requires front, oblique and both side visual review; no measured gas/dust partition.'}};
  await json(resolve(output,'source/finite-material.json'),receipt);await json(resolve(output,'source/validation.json'),receipt.validation);
  const nextProvenance={...provenance,method:'fixed-density-finite-region-material@1',request:{...work,id,outputDirectory:output},material:receipt,qualification:receipt.qualification,validation:receipt.validation};
  const provenanceSha=await json(resolve(output,'source/provenance.json'),nextProvenance);painted.slices.provenance=nextProvenance;
  await json(resolve(output,'prepared/volume-slices.json'),painted.slices);
  const data=compileCssVolume({id,frame,slices:painted.slices,recipe:{anchors:[]}}),prepared={schema:'cssearth-prepared-object@1',id,type:'density-volume',format:'cssearth-density-volume@1',data};
  const volumeSha=await json(resolve(output,'prepared/volume.json'),prepared);
  const descriptor={schema:'cssearth-object@1',id,type:'density-volume',properties:{volume:frame,preparation:{source:'source/provenance.json',sha256:provenanceSha}},prepared:{format:prepared.format,url:'prepared/volume.json',sha256:volumeSha}};
  await json(resolve(output,'object.json'),descriptor);
  const referenceLeafIds=data.stacks.flatMap(s=>s.leaves.map(l=>l.id)),partLeafIds=referenceLeafIds.map(id=>'all-light::'+id);
  const inspection={...prepared,data:{...data,stacks:data.stacks.map(s=>({...s,leaves:s.leaves.flatMap(l=>[l,{...l,id:'all-light::'+l.id}])}))}};
  const inspectionSha=await json(resolve(output,'prepared/inspection.json'),inspection);
  const partsSha=await json(resolve(output,'source/cloud-parts.json'),{schema:'cssearth-cloud-parts@1',id,parts:[{id:'all-light',label:'Finite-region material experiment',kind:'extended',signalFraction:1,defaultEnabled:true,leafIds:partLeafIds}],referenceLeafIds,composition:'Unchanged density and alpha; authored finite XYZ material regions.'});
  await json(resolve(output,'inspection-object.json'),{...descriptor,properties:{...descriptor.properties,preparation:{source:'source/cloud-parts.json',sha256:partsSha}},prepared:{format:prepared.format,url:'prepared/inspection.json',sha256:inspectionSha}});
  const local=relative(root,output),oldLocal=relative(root,baseline);
  const subject=JSON.parse(JSON.stringify(oldResult.subject).replaceAll(oldLocal,local));subject.id=id;subject.name+=' · finite regions';subject.directory=local;subject.reconstructionImage={...subject.reconstructionImage,label:subject.reconstructionImage.label+' · finite regions',note:receipt.qualification.reason};
  await json(resolve(output,'result.json'),{...oldResult,resultId,subject});
  const artifacts:Record<string,{sha256:string;bytes:number}>={};
  async function collect(dir:string){for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())await collect(path);else{const b=await readFile(path);artifacts[relative(output,path)]={sha256:sha256(b),bytes:b.length};}}}
  await collect(output);await json(resolve(output,'manifest.json'),{schema:'cssearth-nebula-reconstruction-artifacts@1',id,sourceSha256:work.source.sha256,artifacts});
  console.log(JSON.stringify({resultId,output,regions:receipt.regions.length,beforeRmse:receipt.beforeRmse,afterRmse:receipt.afterRmse,validationBeforeRmse:receipt.validationBeforeRmse,validationAfterRmse:receipt.validationAfterRmse,sameAlpha:true}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await finiteDensityMaterial(process.argv[2]??'',process.argv[3]??'');
