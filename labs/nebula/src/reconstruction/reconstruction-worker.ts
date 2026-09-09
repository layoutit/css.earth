/** Offline material replacement on one pinned benchmark cloud. Never infer new shape from an image. */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { ReconstructionWork } from './reconstruction-types.js';
import { parseLabModelJson } from '../utils/model-paths.js';
import { createAlignedObservationMapping } from './reconstruction-geometry.js';
import { rectifyObservation, writeObservationPanel } from './filled-products.js';
import { registeredImageSampler, writeOriginalOverlay } from './registered-image.js';
import { recolorCloudSlices } from './cloud-material.js';
import { prepareReconstructionStars } from './reconstruction-stars.js';
import { sha256, containedPath } from '../../../../src/preparation/volume/source.js';
import type { VolumeSlices } from '../../../../src/preparation/volume/slices.js';
import { compileCssVolume } from '../../../../src/renderers/css/preparation/volume.js';

type Progress = { type:'progress'; stage:string; current:number; total:number; message:string };
export const RECONSTRUCTION_SETTINGS = { analysisWidth:1024,originalWidth:2048,quality:92 };
const implementationFiles=['reconstruction-worker.ts','reconstruction-geometry.ts','registered-image.ts','cloud-material.ts',
  'reconstruction-stars.ts','filled-products.ts'].map(name=>'labs/nebula/src/reconstruction/'+name)
  .concat(['labs/nebula/src/alignment/overlay-geometry.ts','src/preparation/volume/raster.ts','src/renderers/css/preparation/volume.ts']);
const json=async(path:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,bytes);return sha256(bytes);};
async function pinned(root:string,pin:{path:string;sha256:string}) {
  if(isAbsolute(pin.path)||!/^[a-f0-9]{64}$/.test(pin.sha256))throw new TypeError('Inputs require repository-relative paths and SHA256 pins.');
  const bytes=await readFile(containedPath(root,pin.path));
  if(sha256(bytes)!==pin.sha256)throw new TypeError(`Reconstruction source changed: ${pin.path}`);
  return bytes;
}
export async function prepareReconstruction(work:ReconstructionWork,options:{root?:string;onProgress?:(progress:Progress)=>void;
  settings?:typeof RECONSTRUCTION_SETTINGS}={}) {
  const started=performance.now(),root=resolve(options.root??process.cwd()),settings=options.settings??RECONSTRUCTION_SETTINGS;
  const progress=(stage:string,current:number,total:number,message:string)=>options.onProgress?.({type:'progress',stage,current,total,message});
  if(work.schema!=='cssearth-nebula-reconstruction-work@1'||!/^reconstruction-[a-f0-9]{64}$/.test(work.id)||
    !work.imageId||!work.name||!isAbsolute(work.outputDirectory)||!work.cloud)throw new TypeError('A reconstruction requires its pinned canonical cloud.');
  const output=resolve(work.outputDirectory),offset=relative(resolve(root,'.local/nebula-lab'),output);
  if(!offset||offset==='..'||offset.startsWith('../')||isAbsolute(offset))throw new TypeError('Reconstruction outputs require their own ignored local directory.');
  const existing=await readdir(output).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error;return [];});
  if(existing.some(name=>name!=='request.json'))throw new TypeError('Reconstruction must not overwrite an existing output.');
  progress('validating',0,3,'Verifying original image, saved starless pixels and the fixed benchmark cloud');
  const native=await pinned(root,work.source),original=await pinned(root,work.original);
  const descriptor=parseLabModelJson((await pinned(root,work.cloud.descriptor)).toString());
  const sourceSlices=parseLabModelJson((await pinned(root,work.cloud.slices)).toString()) as VolumeSlices;
  const evidence=parseLabModelJson((await pinned(root,work.cloud.provenance)).toString());
  const signalBytes=await pinned(root,work.cloud.signal);
  if(descriptor.properties.preparation.sha256!==work.cloud.provenance.sha256||
    JSON.stringify(descriptor.properties.volume.boundsUnits)!==JSON.stringify(sourceSlices.boundsUnits))throw new TypeError('Canonical cloud pins or bounds disagree.');
  const frame=descriptor.properties.volume;
  for(const key of ['referenceFrame','epochJdTt','originM','localToReferenceXyzw','metersPerUnit'])
    if(JSON.stringify(frame[key])!==JSON.stringify((work.frame as any)[key]))throw new TypeError('Material and canonical cloud frames disagree.');
  const [sourceMeta,originalMeta]=await Promise.all([sharp(native).metadata(),sharp(original).metadata()]);
  if(sourceMeta.format!=='png'||sourceMeta.width!==work.source.width||sourceMeta.height!==work.source.height||sourceMeta.hasAlpha||
    sourceMeta.channels!==3||sourceMeta.depth!=='uchar'||originalMeta.width!==sourceMeta.width||originalMeta.height!==sourceMeta.height)
    throw new TypeError('Reconstruction needs a full native RGB8 starless PNG on the original pixel grid.');
  const w=work.overlay.widthPx,h=work.overlay.heightPx;
  const mapping=createAlignedObservationMapping({style:{width:`${w}px`,height:`${h}px`,transform:work.overlay.transform,
    backgroundSize:`${w}px ${h}px`,backgroundPosition:'0px 0px'},pivotCssPx:work.overlay.pivotCssPx,placement:work.overlay.placement},frame,work.overlay.previewModelFit);
  const implementation=Object.fromEntries(await Promise.all(implementationFiles.map(async path=>[path,sha256(await readFile(resolve(root,path)))])));
  await mkdir(resolve(output,'source'),{recursive:true});await mkdir(resolve(output,'prepared'),{recursive:true});
  progress('rectifying',0,2,'Registering image colors into the fixed cloud and catalogue frame');
  const photo=await rectifyObservation(native,mapping,settings.analysisWidth);
  if(!photo.coveredPixels||!photo.intensity.some(v=>v>0))throw new TypeError('Aligned source has no positive covered light.');
  await writeObservationPanel(resolve(output,'source/registered-image.png'),photo,undefined,false);
  await writeObservationPanel(resolve(output,'source/target.png'),photo);
  const aspect=(mapping.boundsUnits.max[1]-mapping.boundsUnits.min[1])/(mapping.boundsUnits.max[0]-mapping.boundsUnits.min[0]);
  let referenceWidth=Math.min(settings.originalWidth,Math.floor(Math.sqrt(4_194_304/aspect)));
  while(referenceWidth*Math.ceil(referenceWidth*aspect)>4_194_304)referenceWidth--;
  const originalPhoto=await rectifyObservation(original,mapping,referenceWidth);
  const reconstructionOverlay=await writeOriginalOverlay(output,originalPhoto,mapping,frame,
    {id:work.imageId,sourcePageUrl:work.sourcePageUrl,credit:work.credit});
  // The benchmark's established cutoff field and stars remain identical across materials.
  const signal=await sharp(signalBytes).flop().removeAlpha().raw().toBuffer({resolveWithObject:true});
  await sharp(signal.data,{raw:{width:signal.info.width,height:signal.info.height,channels:3}}).png().toFile(resolve(output,'source/aligned-image.png'));
  let starsPath:string|undefined;
  if(work.stars) {
    const stars=prepareReconstructionStars(parseLabModelJson((await pinned(root,work.stars)).toString()),
      {frame,source:work.stars,canonicalCloud:work.cloud.descriptor});
    starsPath='prepared/stars.json';await json(resolve(output,starsPath),stars);
  }
  progress('material',0,sourceSlices.quads.length,'Painting the existing cloud; preserving every slice and alpha byte');
  const sourceDirectory=dirname(resolve(root,work.cloud.slices.path));
  const painted=await recolorCloudSlices({slices:sourceSlices,loadResource:path=>readFile(containedPath(sourceDirectory,path)),
    sampleImageRgb:registeredImageSampler(photo,mapping),outputDirectory:resolve(output,'prepared'),encoding:{format:'webp',quality:settings.quality},
    onProgress:p=>{if(p.completed%16===0||p.completed===p.total)progress('material',p.completed,p.total,`Painted ${p.completed}/${p.total} fixed cloud slices`);}});
  const validation={sameGeometry:true,sameAlpha:true,sameStars:true,coverage:painted.coverage};
  const provenance={schema:'cssearth-nebula-reconstruction-provenance@1',method:'fixed-cloud-material-v1',request:work,settings,implementation,
    canonicalCloud:work.cloud,source:work.source,original:work.original,alignment:{...work.overlay,
      convention:'Remove the shared raw-simulation preview fit; retain additional per-image corrections in the fixed benchmark sky frame.'},
    geometry:{tangentBoundsKpc:mapping.boundsUnits,physicalBoundsKpc:sourceSlices.boundsUnits,observerDistanceKpc:mapping.distanceUnits},
    photo:{width:photo.width,height:photo.height,nativeDimensions:[work.source.width,work.source.height]},
    densityProjection:{width:signal.info.width,height:signal.info.height,tangentBoundsKpc:{
      min:evidence.observation.tangentBoundsKpc.min.slice(0,2),max:evidence.observation.tangentBoundsKpc.max.slice(0,2)},
      observerDistanceKpc:evidence.observation.distanceKpc,meaning:'Unchanged canonical cloud reference projection; identical cutoff for all materials.'},
    validation,limitations:['The accepted benchmark cloud is a modeled reconstruction, not measured gas depth.',
      'Candidate chromaticity paints the fixed cloud. Image brightness never changes geometry or alpha.',
      'Uncovered or black image samples retain benchmark source colors; coverage counts record this mixed-source material.',
      'Catalogue positions, inferred depths and reference cloud support remain unchanged.']};
  painted.slices.provenance=provenance;
  await json(resolve(output,'prepared/volume-slices.json'),painted.slices);
  const data=compileCssVolume({id:work.id,frame,slices:painted.slices,recipe:{anchors:[]}});
  const prepared={schema:'cssearth-prepared-object@1',id:work.id,type:'density-volume',format:'cssearth-density-volume@1',data};
  const provenanceSha=await json(resolve(output,'source/provenance.json'),provenance);
  await json(resolve(output,'source/validation.json'),validation);
  const volumeSha=await json(resolve(output,'prepared/volume.json'),prepared);
  const resultDescriptor={schema:'cssearth-object@1',id:work.id,type:'density-volume',properties:{volume:frame,
    preparation:{source:'source/provenance.json',sha256:provenanceSha}},prepared:{format:prepared.format,url:'prepared/volume.json',sha256:volumeSha}};
  await json(resolve(output,'object.json'),resultDescriptor);
  const referenceLeafIds=data.stacks.flatMap(stack=>stack.leaves.map(leaf=>leaf.id)),partLeafIds=referenceLeafIds.map(id=>'all-light::'+id);
  const inspection={...prepared,data:{...data,stacks:data.stacks.map(stack=>({...stack,leaves:stack.leaves.flatMap(leaf=>[leaf,{...leaf,id:'all-light::'+leaf.id}])}))}};
  const inspectionSha=await json(resolve(output,'prepared/inspection.json'),inspection);
  const catalogueSha=await json(resolve(output,'source/cloud-parts.json'),{schema:'cssearth-cloud-parts@1',id:work.id,
    parts:[{id:'all-light',label:'Reference cloud',kind:'extended',signalFraction:1,defaultEnabled:true,leafIds:partLeafIds}],referenceLeafIds,
    composition:'One immutable reference cloud; candidate images replace material colors only.'});
  await json(resolve(output,'inspection-object.json'),{...resultDescriptor,properties:{...resultDescriptor.properties,
    preparation:{source:'source/cloud-parts.json',sha256:catalogueSha}},prepared:{format:prepared.format,url:'prepared/inspection.json',sha256:inspectionSha}});
  const artifacts:Record<string,{sha256:string;bytes:number}>={};
  async function collect(directory:string){for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);if(entry.isDirectory())await collect(path);else{const bytes=await readFile(path);artifacts[relative(output,path)]={sha256:sha256(bytes),bytes:bytes.length};}}}
  await collect(output);
  await json(resolve(output,'manifest.json'),{schema:'cssearth-nebula-reconstruction-artifacts@1',id:work.id,sourceSha256:work.source.sha256,
    removalResultId:work.original.removalResultId,artifacts,elapsedSeconds:(performance.now()-started)/1000});
  progress('complete',1,1,'Fixed cloud material and original comparison are ready');
  return {type:'complete' as const,stars:starsPath,reconstructionOverlay,cloudParts:{descriptor:'inspection-object.json',catalogue:'source/cloud-parts.json'}};
}
if(/^reconstruction-worker\.(?:mjs|ts|js)$/.test(basename(process.argv[1]??''))&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const complete=await prepareReconstruction(parseLabModelJson(input),{onProgress:p=>console.log(JSON.stringify(p))});console.log(JSON.stringify(complete));
}
