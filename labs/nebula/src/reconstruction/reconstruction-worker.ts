import { parseLabModelJson } from '../utils/model-paths.js';
/** Offline, explicit NOX-image colors on one shared density volume. No inference or source writes. */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { ReconstructionWork } from './reconstruction-types.js';
import { createAlignedObservationMapping } from './reconstruction-geometry.js';
import { rectifyObservation, writeObservationPanel } from './filled-products.js';
import { createDensityColorVolumeSampler } from './density-color-volume.js';
import { prepareDensityProjection } from './density-projection.js';
import { prepareReconstructionStars } from './reconstruction-stars.js';
import { bakeMasterVolumeSlices } from './master-slices.js';
import { validateCoherentAxisSampling } from './coherent-validation.js';
import { loadVolumeSource, sha256, containedPath } from '../../../../src/preparation/volume/source.js';
import type { Bounds3, VolumeRecipe } from '../../../../src/preparation/volume/config.js';
import { compileCssVolume } from '../../../../src/renderers/css/preparation/volume.js';

type Progress = { type:'progress'; stage:string; current:number; total:number; message:string };
export const RECONSTRUCTION_SETTINGS = {
  analysisWidth:512, masterWidth:512, deliveryWidth:512,
  longestAxisSlices:128, samplesPerSlab:8,
  densityScale:1,exposureGain:.6,quality:92,
};
/** Comparable physical pitch prevents one projection bank collapsing more depth than another. */
export function reconstructionSliceCounts(bounds:Bounds3,longestAxisSlices:number) {
  if(!Number.isInteger(longestAxisSlices)||longestAxisSlices<1||longestAxisSlices>512)
    throw new TypeError('Longest axis requires 1–512 slices.');
  const spans=bounds.max.map((value,i)=>value-bounds.min[i]);
  if(spans.length!==3||bounds.min.length!==3||bounds.max.some(value=>!Number.isFinite(value))||
      bounds.min.some(value=>!Number.isFinite(value))||spans.some(value=>!(value>0)))
    throw new TypeError('Slice bounds require finite increasing XYZ intervals.');
  const longest=Math.max(...spans),counts=spans.map(span=>Math.max(1,Math.round(longestAxisSlices*span/longest)));
  return {x:counts[0]!,y:counts[1]!,z:counts[2]!};
}
const implementationFiles = ['reconstruction/reconstruction-worker.ts','reconstruction/reconstruction-geometry.ts','reconstruction/filled-products.ts','reconstruction/filled-components.ts',
  'reconstruction/density-color-volume.ts','reconstruction/density-projection.ts','reconstruction/reconstruction-stars.ts','reconstruction/master-slices.ts','density/observation-prior.ts','reconstruction/coherent-validation.ts','alignment/overlay-placement.ts']
  .map(name=>'labs/nebula/src/'+name).concat(['src/preparation/volume/source.ts','src/preparation/volume/slices.ts',
    'src/preparation/volume/raster.ts','src/renderers/css/preparation/volume.ts']);
const json = async (path:string,value:unknown) => { const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n'); await writeFile(path,bytes); return sha256(bytes); };
/** Numerical work only: select one converged integration count before writing any slice bank. */
export function chooseReconstructionSampling<T>(initial:number, verify:(samplesPerSlab:number)=>T,
  onAttempt?:(samplesPerSlab:number)=>void) {
  const attempts:{samplesPerSlab:number;passed:boolean;error?:string}[]=[];
  for (const samplesPerSlab of [...new Set([initial,16,32])].filter(n=>n>=initial).sort((a,b)=>a-b)) {
    onAttempt?.(samplesPerSlab);
    try {
      const validation=verify(samplesPerSlab);attempts.push({samplesPerSlab,passed:true});
      return {samplesPerSlab,validation,attempts};
    } catch(error) {
      const message=error instanceof Error?error.message:String(error);
      if (!/quadrature has not converged|Observed color projection is not converged/.test(message)) throw error;
      attempts.push({samplesPerSlab,passed:false,error:message});
    }
  }
  throw new Error(`Reconstruction integration did not converge within32 samples per slab: ${JSON.stringify(attempts)}`);
}
async function pinned(root:string,pin:{path:string;sha256:string}) {
  if (isAbsolute(pin.path) || !/^[a-f0-9]{64}$/.test(pin.sha256)) throw new TypeError('Inputs require repository-relative paths and SHA256 pins.');
  const bytes=await readFile(containedPath(root,pin.path));
  if (sha256(bytes)!==pin.sha256) throw new TypeError(`Reconstruction source changed: ${pin.path}`);
  return bytes;
}

export async function prepareReconstruction(work:ReconstructionWork, options:{
  root?:string; onProgress?:(progress:Progress)=>void;
  /** Test-only small synthetic bake; the CLI always uses the fixed comparison settings above. */
  settings?:typeof RECONSTRUCTION_SETTINGS;
}={}) {
  const started=performance.now(),root=resolve(options.root??process.cwd()),settings={...(options.settings??RECONSTRUCTION_SETTINGS)};
  const progress=(stage:string,current:number,total:number,message:string)=>options.onProgress?.({type:'progress',stage,current,total,message});
  if (work.schema!=='cssearth-nebula-reconstruction-work@1' || !/^reconstruction-[a-f0-9]{64}$/.test(work.id) ||
      !work.imageId || !work.name || !isAbsolute(work.outputDirectory)) throw new TypeError('Invalid reconstruction work identity.');
  const output=resolve(work.outputDirectory),offset=relative(resolve(root,'.local/nebula-lab'),output);
  if (!offset || offset==='..' || offset.startsWith('../') || isAbsolute(offset)) throw new TypeError('Reconstruction outputs require their own ignored local directory.');
  const existing=await readdir(output).catch((error:NodeJS.ErrnoException)=>{if(error.code!=='ENOENT')throw error;return [];});
  if (existing.some(name=>name!=='request.json')) throw new TypeError('Reconstruction must not overwrite an existing output.');
  progress('validating',0,3,'Verifying native starless source, original image and unchanged stellar prior');
  const native=await pinned(root,work.source),original=await pinned(root,work.original),priorBytes=await pinned(root,work.stellarPrior);
  const [sourceMeta,originalMeta]=await Promise.all([sharp(native).metadata(),sharp(original).metadata()]);
  if (sourceMeta.format!=='png' || sourceMeta.width!==work.source.width || sourceMeta.height!==work.source.height ||
      sourceMeta.hasAlpha || sourceMeta.channels!==3 || sourceMeta.depth!=='uchar' || originalMeta.width!==sourceMeta.width || originalMeta.height!==sourceMeta.height)
    throw new TypeError('Reconstruction needs a full native RGB8 starless PNG on the original pixel grid.');
  const w=work.overlay.widthPx,h=work.overlay.heightPx;
  const mapping=createAlignedObservationMapping({style:{width:`${w}px`,height:`${h}px`,transform:work.overlay.transform,
    backgroundSize:`${w}px ${h}px`,backgroundPosition:'0px 0px'},pivotCssPx:work.overlay.pivotCssPx,placement:work.overlay.placement},work.frame);
  const stellarRecipe=parseLabModelJson(priorBytes.toString()) as VolumeRecipe;
  const stellar=await loadVolumeSource(dirname(resolve(root,work.stellarPrior.path)),stellarRecipe);
  const originalPriorSha=sha256(stellar.encodedRgba);
  const implementation=Object.fromEntries(await Promise.all(implementationFiles.map(async path=>[path,sha256(await readFile(resolve(root,path)))])));
  await mkdir(resolve(output,'source'),{recursive:true});
  progress('rectifying',0,1,'Sampling the full native NOX image through the saved Alignment transform');
  const photo=await rectifyObservation(native,mapping,settings.analysisWidth);
  if (!photo.coveredPixels || !photo.intensity.some(v=>v>0)) throw new TypeError('Aligned source has no positive covered light.');
  await writeObservationPanel(resolve(output,'source/registered-image.png'),photo,undefined,false);
  await writeObservationPanel(resolve(output,'source/target.png'),photo);
  progress('density',0,1,'Applying image colors only inside the unchanged physical density volume');
  const sampler=createDensityColorVolumeSampler({source:stellar,mapping,photo,densityScale:settings.densityScale});
  const bounds=sampler.supportBoundsKpc, sample=sampler.sample;
  const sliceCounts=reconstructionSliceCounts(bounds,settings.longestAxisSlices);
  progress('density-projection',0,1,'Preparing the common density cutoff and star support, independent of the image');
  const densityProjection=prepareDensityProjection(stellar,mapping.distanceUnits,256);
  await writeObservationPanel(resolve(output,'source/aligned-image.png'),densityProjection.photo,undefined,false);
  let starsPath:string|undefined;
  if(work.stars) {
    const existing=parseLabModelJson((await pinned(root,work.stars)).toString());
    const stars=prepareReconstructionStars(existing,{frame:work.frame,source:work.stars,
      sampleDensity:densityProjection.densityAt,sampleProjectedDensitySignal:densityProjection.sampleSignal});
    starsPath='prepared/stars.json';await mkdir(resolve(output,'prepared'),{recursive:true});
    await json(resolve(output,starsPath),stars);
  }
  progress('validating-volume',0,1,'Checking density-owned support and independent XYZ integration');
  if (sha256(stellar.encodedRgba)!==originalPriorSha) throw new Error('Stellar density was modified.');
  const sampling=chooseReconstructionSampling(settings.samplesPerSlab,samplesPerSlab=>({
    quadrature:validateCoherentAxisSampling({sampler:{sample},bounds,samples:{x:sliceCounts.x*samplesPerSlab,
      y:sliceCounts.y*samplesPerSlab,z:sliceCounts.z*samplesPerSlab},exposureGain:settings.exposureGain}),
  }),samples=>progress('validating-volume',0,1,`Checking numerical convergence at ${samples} samples per slab before baking`));
  settings.samplesPerSlab=sampling.samplesPerSlab;
  const validation={...sampling.validation,integrationSelection:{samplesPerSlab:sampling.samplesPerSlab,attempts:sampling.attempts}};
  const provenance={schema:'cssearth-nebula-reconstruction-provenance@1',method:'density-owned-image-color-v1',
    request:work,settings:{...settings,sliceCounts},implementation,source:work.source,original:work.original,alignment:work.overlay,
    geometry:{uvConvention:'Full image edges; pixel centres ((x+.5)/width,(y+.5)/height).',
      transform:'Prepared CSS matrix, then T(saved)*T(pivot)*Rz*Ry*Rx*S*T(-pivot); undo [physicalY,physicalX,physicalZ]*50; project Earth rays to z=0.',
      tangentBoundsKpc:mapping.boundsUnits,physicalBoundsKpc:bounds,observerDistanceKpc:mapping.distanceUnits},
    photo:{width:photo.width,height:photo.height,coveredPixels:photo.coveredPixels,nativeDimensions:[work.source.width,work.source.height]},
    densityProjection:{width:densityProjection.photo.width,height:densityProjection.photo.height,
      tangentBoundsKpc:densityProjection.boundsUnits,observerDistanceKpc:densityProjection.distanceUnits,
      meaning:'One common integrated stellar-density field controls cutoff and star support for every color image.'},
    volume:{support:'unchanged physical density',densityScale:settings.densityScale,
      noImageDepth:true,sharedSliceGeometry:true,starsImageIndependent:true},validation,
    stellarPrior:{...work.stellarPrior,grid:stellarRecipe.grid,decodedSha256:originalPriorSha,unchanged:true},
    limitations:['Image RGB colors the existing simulated stellar density; no photographic background is extruded into empty space.',
      'One fixed full-density extent and XYZ slicing is shared by all images. Display brightness is not calibrated photometry.',
      'The stellar distribution is a visualization shape, not measured gas/dust depth. Image color cannot recover hidden geometry.',
      'Unobserved image coverage remains uncolored; the unchanged density and catalogue remain available in Alignment.',
      'Finite XYZ slabs, quadrature, RGBA8 and compressed RGB approximate the continuous field.',
      'Stars retain inherited catalogue sky positions and modeled depth; image selection never repositions or selects them.'],
  };
  progress('slices',0,sliceCounts.x+sliceCounts.y+sliceCounts.z,'Baking static CSS XYZ slice banks offline');
  const baked=await bakeMasterVolumeSlices({sampleEmission:sample,boundsKpc:bounds,sliceCounts,
    samplesPerSlab:settings.samplesPerSlab,exposureGain:settings.exposureGain,masterWidth:settings.masterWidth,
    masterDirectory:resolve(output,'masters'),cropTransparent:false,deliveryBanks:[{width:settings.deliveryWidth,outputDirectory:resolve(output,'prepared'),
      imageEncoding:{format:'webp',quality:settings.quality}}],unitsPerSourceUnit:1,provenance,
    onProgress:p=>progress(p.phase==='master'?'slices':'delivery',p.completed,p.total,`${p.phase==='master'?'Baked':'Encoded'} ${p.axis.toUpperCase()} slice ${p.sliceIndex+1}; ${p.completed}/${p.total}`)});
  const frame={...work.frame,boundsUnits:bounds},data=compileCssVolume({id:work.id,frame,slices:baked.banks[0]!.slices,recipe:{anchors:[]}});
  const prepared={schema:'cssearth-prepared-object@1',id:work.id,type:'density-volume',format:'cssearth-density-volume@1',data};
  const provenanceSha=await json(resolve(output,'source/provenance.json'),provenance);
  await json(resolve(output,'source/validation.json'),validation);
  const volumeSha=await json(resolve(output,'prepared/volume.json'),prepared);
  const descriptor={schema:'cssearth-object@1',id:work.id,type:'density-volume',properties:{volume:frame,
    preparation:{source:'source/provenance.json',sha256:provenanceSha}},prepared:{format:prepared.format,url:'prepared/volume.json',sha256:volumeSha}};
  await json(resolve(output,'object.json'),descriptor);
  // One exact all-light contribution reuses resources; hidden duplicates satisfy the existing retained inspection ownership contract.
  const referenceLeafIds=data.stacks.flatMap(stack=>stack.leaves.map(leaf=>leaf.id)),partLeafIds=referenceLeafIds.map(id=>'all-light::'+id);
  const inspection={...prepared,data:{...data,stacks:data.stacks.map(stack=>({...stack,leaves:stack.leaves.flatMap(leaf=>
    [leaf,{...leaf,id:'all-light::'+leaf.id}])}))}};
  const inspectionSha=await json(resolve(output,'prepared/inspection.json'),inspection);
  const catalogueSha=await json(resolve(output,'source/cloud-parts.json'),{schema:'cssearth-cloud-parts@1',id:work.id,
    parts:[{id:'all-light',label:'Density cloud',kind:'extended',signalFraction:1,defaultEnabled:true,leafIds:partLeafIds}],referenceLeafIds,
    composition:'One density-owned cloud. Image RGB changes material only; density and stars are independent of image selection.'});
  await json(resolve(output,'inspection-object.json'),{...descriptor,properties:{...descriptor.properties,
    preparation:{source:'source/cloud-parts.json',sha256:catalogueSha}},prepared:{format:prepared.format,url:'prepared/inspection.json',sha256:inspectionSha}});
  const artifacts:Record<string,{sha256:string;bytes:number}>={};
  async function collect(directory:string) { for (const name of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,name.name);if(name.isDirectory())await collect(path);else{const bytes=await readFile(path);artifacts[relative(output,path)]={sha256:sha256(bytes),bytes:bytes.length};}
  } }
  await collect(output);
  const framingRadiusUnits=Math.hypot(...[0,1,2].map(i=>Math.max(Math.abs(bounds.min[i]),Math.abs(bounds.max[i]))));
  await json(resolve(output,'manifest.json'),{schema:'cssearth-nebula-reconstruction-artifacts@1',id:work.id,sourceSha256:work.source.sha256,
    removalResultId:work.original.removalResultId,artifacts,elapsedSeconds:(performance.now()-started)/1000,framingRadiusUnits});
  progress('complete',1,1,'Prepared reconstruction verified and ready');
  // Full support bounds are not the inspection framing: keep the subject's common camera scale.
  return {type:'complete' as const,stars:starsPath,cloudParts:{descriptor:'inspection-object.json',catalogue:'source/cloud-parts.json'}};
}

if (/^reconstruction-worker\.(?:mjs|ts|js)$/.test(basename(process.argv[1]??'')) && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const complete=await prepareReconstruction(parseLabModelJson(input),{onProgress:p=>console.log(JSON.stringify(p))});
  console.log(JSON.stringify(complete));
}
