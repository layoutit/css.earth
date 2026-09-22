import { implementationPins } from '../services/implementation.ts';
/** Offline material replacement on the exact pinned Alignment density cloud. Never infer new shape from an image. */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parseDensityPlacement, densityPlacementTransform } from '@cssearth/volume-core/coordinates/density-placement';
import type { ReconstructionWork } from '../../features/reconstruction/reconstruction-types.ts';
import { parseLabModelJson } from '../../resources/model-paths.ts';
import { createAlignedObservationMapping } from '@cssearth/volume-core/coordinates/observation-mapping';
import { rectifyObservation, writeObservationPanel } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { registeredImageSampler, registeredScalarSampler, writeOriginalOverlay } from '../workflows/density/registered-image.ts';
import { recolorCloudSlices } from '@cssearth/volume-bake/slices/material';
import { parseCloudAppearance } from '@cssearth/volume-core/materials/cloud-appearance';
import { prepareCloudDetail, CLOUD_DETAIL_METHOD } from '@cssearth/volume-core/materials/cloud-detail';
import { prepareDensityProjection } from '../workflows/density/density-projection.ts';
import { parseVolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
import { prepareReconstructionStars } from '../workflows/density/reconstruction-stars.ts';
import { sha256, containedPath, loadVolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';
import type { VolumeSlices } from '@cssearth/volume-bake/slices/density';
import { compileCssVolume } from '../../adapters/preparation/css-volume.ts';

type Progress = { type:'progress'; stage:string; current:number; total:number; message:string };
export const RECONSTRUCTION_SETTINGS = { analysisWidth:1024,originalWidth:2048,quality:92 };

const json=async(path:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,bytes);return sha256(bytes);};
async function pinned(root:string,pin:{path:string}) {
  if(isAbsolute(pin.path))throw new TypeError('Inputs require repository-relative paths.');
  return readFile(containedPath(root,pin.path));
}
export async function prepareReconstruction(work:ReconstructionWork,options:{root?:string;onProgress?:(progress:Progress)=>void;
  settings?:typeof RECONSTRUCTION_SETTINGS}={}) {
  const started=performance.now(),root=resolve(options.root??process.cwd()),settings=options.settings??RECONSTRUCTION_SETTINGS;
  const appearance=parseCloudAppearance(work.appearance);
  const progress=(stage:string,current:number,total:number,message:string)=>options.onProgress?.({type:'progress',stage,current,total,message});
  if(work.schema!=='cssearth-nebula-reconstruction-work@1'||!/^reconstruction-[a-f0-9]{64}$/.test(work.id)||
    !work.imageId||!work.name||!isAbsolute(work.outputDirectory)||!work.cloud)throw new TypeError('A reconstruction requires its pinned canonical cloud.');
  const output=resolve(work.outputDirectory),offset=relative(resolve(root,'.local/nebula-lab'),output);
  if(!offset||offset==='..'||offset.startsWith('../')||isAbsolute(offset))throw new TypeError('Reconstruction outputs require their own ignored local directory.');
  const existing=await readdir(output).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error;return [];});
  if(existing.some(name=>name!=='request.json'))throw new TypeError('Reconstruction must not overwrite an existing output.');
  progress('validating',0,3,'Verifying original image, saved starless pixels and the Alignment density cloud');
  const native=await pinned(root,work.source),original=await pinned(root,work.original);
  const descriptor=parseLabModelJson((await pinned(root,work.cloud.descriptor)).toString());
  const sourceSlices=parseLabModelJson((await pinned(root,work.cloud.slices)).toString()) as VolumeSlices;
  const evidence=parseLabModelJson((await pinned(root,work.cloud.provenance)).toString());
  const placement = work.cloud.modelPlacement ? parseDensityPlacement(parseLabModelJson((await pinned(root,work.cloud.modelPlacement)).toString())) : undefined;
  if (placement && JSON.stringify((sourceSlices.provenance as { identity?: { placement?: unknown } }).identity?.placement) !== JSON.stringify(work.cloud.modelPlacement))
    throw new TypeError('Placed density geometry and authored placement pin disagree.');
  if (placement && work.stars) throw new TypeError('Placed density with an observed stellar catalogue requires a separately qualified catalogue realization.');
  if(JSON.stringify(descriptor.properties.volume.boundsUnits)!==JSON.stringify(sourceSlices.boundsUnits))throw new TypeError('Canonical cloud pins or bounds disagree.');
  const frame=descriptor.properties.volume;
  for(const key of ['referenceFrame','epochJdTt','originM','localToReferenceXyzw','metersPerUnit'])
    if(JSON.stringify(frame[key])!==JSON.stringify((work.frame as any)[key]))throw new TypeError('Material and canonical cloud frames disagree.');
  const [sourceMeta,originalMeta]=await Promise.all([sharp(native).metadata(),sharp(original).metadata()]);
  if(sourceMeta.format!=='png'||sourceMeta.width!==work.source.width||sourceMeta.height!==work.source.height||sourceMeta.hasAlpha||
    sourceMeta.channels!==3||sourceMeta.depth!=='uchar'||originalMeta.width!==sourceMeta.width||originalMeta.height!==sourceMeta.height)
    throw new TypeError('Reconstruction needs a full native RGB8 starless PNG on the original pixel grid.');
  const w=work.overlay.widthPx,h=work.overlay.heightPx;
  const mapping=createAlignedObservationMapping({style:{width:`${w}px`,height:`${h}px`,transform:work.overlay.transform,
    backgroundSize:`${w}px ${h}px`,backgroundPosition:'0px 0px'},pivotCssPx:work.overlay.pivotCssPx,placement:work.overlay.placement},frame);
  const implementation=Object.fromEntries((await implementationPins(root, ['labs/nebula/packages/lab/src/server/workers/density-reconstruction.ts'])).map(pin => [pin.path, pin.sha256]));
  await mkdir(resolve(output,'source'),{recursive:true});await mkdir(resolve(output,'prepared'),{recursive:true});
  progress('rectifying',0,2,'Registering image colors into the fixed cloud and catalogue frame');
  const photo=await rectifyObservation(native,mapping,settings.analysisWidth);
  if(!photo.coveredPixels||!photo.intensity.some(v=>v>0))throw new TypeError('Aligned source has no positive covered light.');
  await writeObservationPanel(resolve(output,'source/registered-image.png'),photo,undefined,false);
  await writeObservationPanel(resolve(output,'source/target.png'),photo);
  progress('detail',0,1,'Preparing saturation and local image detail in the shared cloud frame');
  const detailGain=prepareCloudDetail(photo,mapping,appearance);
  const aspect=(mapping.boundsUnits.max[1]-mapping.boundsUnits.min[1])/(mapping.boundsUnits.max[0]-mapping.boundsUnits.min[0]);
  let referenceWidth=Math.min(settings.originalWidth,Math.floor(Math.sqrt(4_194_304/aspect)));
  while(referenceWidth*Math.ceil(referenceWidth*aspect)>4_194_304)referenceWidth--;
  const originalPhoto=await rectifyObservation(original,mapping,referenceWidth);
  const reconstructionOverlay=await writeOriginalOverlay(output,originalPhoto,mapping,frame,
    {id:work.imageId,sourcePageUrl:work.sourcePageUrl,credit:work.credit});
  // Read the same pinned density source as Alignment; never rebuild its delivery geometry.
  progress('density',0,1,'Preparing one source-independent density signal and stellar support');
  const densitySource=await loadVolumeSource(dirname(resolve(root,work.cloud.provenance.path)),parseVolumeRecipe(evidence));
  const densityBounds=placement ? densityPlacementTransform(placement).bounds(densitySource.recipe.grid.bounds) : densitySource.recipe.grid.bounds;
  if(JSON.stringify(densityBounds)!==JSON.stringify(frame.boundsUnits))
    throw new TypeError('Alignment density and prepared cloud bounds disagree.');
  const densityProjection=prepareDensityProjection(densitySource,mapping.distanceUnits,256,placement);
  await writeObservationPanel(resolve(output,'source/aligned-image.png'),densityProjection.photo,undefined,false);
  let starsPath:string|undefined;
  if(work.stars) {
    if(!work.cloud.starAlignment)throw new TypeError('Catalogue requires the common Alignment star reference.');
    await pinned(root,work.cloud.starAlignment.provenancePin);
    const stars=prepareReconstructionStars(parseLabModelJson((await pinned(root,work.stars)).toString()),
      {frame,source:work.stars,canonicalCloud:work.cloud.descriptor,densitySource,
        reference:work.cloud.starAlignment,sampleProjectedDensitySignal:densityProjection.sampleSignal});
    starsPath='prepared/stars.json';await json(resolve(output,starsPath),stars);
  }
  progress('material',0,sourceSlices.quads.length,'Painting the existing cloud; preserving every slice and alpha byte');
  const sourceDirectory=dirname(resolve(root,work.cloud.slices.path));
  const painted=await recolorCloudSlices({slices:sourceSlices,loadResource:path=>readFile(containedPath(sourceDirectory,path)),
    sampleImageRgb:registeredImageSampler(photo,mapping),appearance,sampleDetailGain:registeredScalarSampler(photo,detailGain,mapping),
    outputDirectory:resolve(output,'prepared'),encoding:{format:'webp',quality:settings.quality},
    onProgress:p=>{if(p.completed%16===0||p.completed===p.total)progress('material',p.completed,p.total,`Painted ${p.completed}/${p.total} fixed cloud slices`);}});
  const validation={sameGeometry:true,sameAlpha:true,sameStars:true,coverage:painted.coverage};
  const provenance={schema:'cssearth-nebula-reconstruction-provenance@1',method:'alignment-density-material-v1',request:work,settings,implementation,
    canonicalCloud:work.cloud,source:work.source,original:work.original,
    material:{appearance,detailMethod:CLOUD_DETAIL_METHOD,scale:'Radius in pixels at 1024px registered width.',
      contrast:'Three coverage-normalized box passes; bounded local luminance ratio deepens dark structure, preserving highlight headroom. Authored RGB material only; no inferred depth.'},alignment:{...work.overlay,
      convention:'Use the exact saved Alignment placement, including scale, pivot, all rotations and offsets.'},
    geometry:{tangentBoundsKpc:mapping.boundsUnits,physicalBoundsKpc:sourceSlices.boundsUnits,observerDistanceKpc:mapping.distanceUnits,originalImageLandmarks:[0,.5,1].flatMap(v=>[0,.5,1].map(u=>{
      const [x,y]=mapping.tangentAtUv(u,v),{min,max}=mapping.boundsUnits;
      return {uv:[u,v],pixel:[(x-min[0])/(max[0]-min[0])*originalPhoto.width,(max[1]-y)/(max[1]-min[1])*originalPhoto.height]};}))},
    photo:{width:photo.width,height:photo.height,nativeDimensions:[work.source.width,work.source.height]},
    densityProjection:{width:densityProjection.photo.width,height:densityProjection.photo.height,
      tangentBoundsKpc:densityProjection.boundsUnits,observerDistanceKpc:densityProjection.distanceUnits,
      meaning:'Integrated signal of the untouched Alignment density source; identical cutoff for all materials.'},
    qualification:{status:'research-baseline',materialGatePassed:false,reason:'Projected image color is repeated through line-of-sight depth; finite 3D material is not inferred.'},
    validation,limitations:['Projected colors do not pass the finite-3D-material gate; this result is an inspection baseline, not a qualified cloud.',
      'The Alignment cloud is simulated stellar density, not measured gas depth.',
      'Candidate color and optional local contrast paint the fixed cloud. Image brightness never changes geometry or alpha.',
      'Uncovered or black image samples retain neutral density colors; coverage counts record this mixed-source material.',
      'Catalogue astrometry is preserved; one common Alignment mapping and density-conditioned model supplies the same stellar positions for every material.']};
  painted.slices.provenance=provenance;
  await json(resolve(output,'prepared/volume-slices.json'),painted.slices);
  const data=compileCssVolume({id:work.id,frame,slices:painted.slices,recipe:{anchors:[]}});
  const prepared={schema:'cssearth-prepared-object@1',id:work.id,type:'density-volume',format:'cssearth-density-volume@1',data};
  const provenanceSha=await json(resolve(output,'source/provenance.json'),provenance);
  await json(resolve(output,'source/validation.json'),validation);
  const volumeSha=await json(resolve(output,'prepared/volume.json'),prepared);
  const resultDescriptor={schema:'cssearth-object@1',id:work.id,type:'density-volume',properties:{volume:frame,
    preparation:{source:'source/provenance.json'}},prepared:{format:prepared.format,url:'prepared/volume.json'}};
  await json(resolve(output,'object.json'),resultDescriptor);
  const referenceLeafIds=data.stacks.flatMap(stack=>stack.leaves.map(leaf=>leaf.id)),partLeafIds=referenceLeafIds.map(id=>'all-light::'+id);
  const inspection={...prepared,data:{...data,stacks:data.stacks.map(stack=>({...stack,leaves:stack.leaves.flatMap(leaf=>[leaf,{...leaf,id:'all-light::'+leaf.id}])}))}};
  const inspectionSha=await json(resolve(output,'prepared/inspection.json'),inspection);
  const catalogueSha=await json(resolve(output,'source/cloud-parts.json'),{schema:'cssearth-cloud-parts@1',id:work.id,
    parts:[{id:'all-light',label:'Reference cloud',kind:'extended',signalFraction:1,defaultEnabled:true,leafIds:partLeafIds}],referenceLeafIds,
    composition:'One immutable Alignment density cloud; candidate images replace material colors only.'});
  await json(resolve(output,'inspection-object.json'),{...resultDescriptor,properties:{...resultDescriptor.properties,
    preparation:{source:'source/cloud-parts.json'}},prepared:{format:prepared.format,url:'prepared/inspection.json'}});
  const artifacts:Record<string,{sha256:string;bytes:number}>={};
  async function collect(directory:string){for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name);if(entry.isDirectory())await collect(path);else{const bytes=await readFile(path);artifacts[relative(output,path)]={sha256:sha256(bytes),bytes:bytes.length};}}}
  await collect(output);
  await json(resolve(output,'manifest.json'),{schema:'cssearth-nebula-reconstruction-artifacts@1',id:work.id,
    removalResultId:work.original.removalResultId,artifacts,elapsedSeconds:(performance.now()-started)/1000});
  progress('complete',1,1,'Fixed cloud material and original comparison are ready');
  return {type:'complete' as const,stars:starsPath,reconstructionOverlay,cloudParts:{descriptor:'inspection-object.json',catalogue:'source/cloud-parts.json'}};
}
if(/^reconstruction-worker\.(?:mjs|ts|js)$/.test(basename(process.argv[1]??''))&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const complete=await prepareReconstruction(parseLabModelJson(input),{onProgress:p=>console.log(JSON.stringify(p))});console.log(JSON.stringify(complete));
}
