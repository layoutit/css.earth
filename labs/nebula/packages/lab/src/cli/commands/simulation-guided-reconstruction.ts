import { collectArtifacts } from '../../server/workflows/density/io.ts';
/** Offline conditional emission experiment; originals and baseline remain immutable. */
import {readFile,writeFile,mkdir,cp,rename} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import sharp from 'sharp';
import {parseLabModelJson} from '../../resources/model-paths.ts';
import {implementationPins} from '../../server/services/implementation.ts';
import {compileCssVolume} from '../../adapters/preparation/css-volume.ts';
import {verifyFiniteMaterialArtifacts} from './finite-density-material-artifacts.ts';
import {physicalToField,angularScale,physicalBounds} from './simulation-guided-coordinates.ts';
import {parseSimulationGuidedLevels} from './simulation-guided-levels.ts';
import {fitSimulationGuidedEmission} from '@cssearth/nebula-reconstruction/methods/inference/simulation-guided';
import {fitSimulationEnvelope,createEnvelopeSampler,envelopeChromaticity,validateEnvelopeSettings,envelopeChromaSettings} from '@cssearth/nebula-reconstruction/methods/inference/simulation-envelope';
import {loadSimulationPrior} from './simulation-prior.ts';
import {compilerSlabMaterial,alphaLimitedSlabMaterial} from '@cssearth/volume-core/materials/slab-material';
import {bakeMasterVolumeSlices} from '@cssearth/volume-bake/slices/emission';
import {recolorCloudSlices} from '@cssearth/volume-bake/slices/material';
import {sourceBytes,sha256,containedPath} from '@cssearth/volume-bake/compact-inputs/density-grid';
import type {Vector3} from '@cssearth/volume-core/contracts/volume-recipe';
import type {SkyBounds,EmissionBounds} from '@cssearth/volume-core/contracts/emission';
const json=async(path:string,value:unknown)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,b);return sha256(b);};
async function main(settingsPath:string){
 const root=process.cwd(),settingsBytes=await readFile(settingsPath),s=parseLabModelJson(settingsBytes.toString());
 if(s.schema!=='cssearth-simulation-guided-reconstruction@1'||!/^[a-f0-9]{64}$/.test(s.baselineId)||!Number.isInteger(s.width)||s.width<32||s.width>512||!Number.isInteger(s.longestAxisSlabs)||s.longestAxisSlabs<16||s.longestAxisSlabs>256||s.samplesPerSlab!==4||!Number.isFinite(s.backgroundSpread)||s.backgroundSpread<0||s.backgroundSpread>3||!Number.isFinite(s.exposureGain)||s.exposureGain<=0||s.exposureGain>10||!Array.isArray(s.exclusions))throw Error('Invalid bounded simulation-guided settings');
 const envelopeSettings=s.envelope===undefined?null:validateEnvelopeSettings(s.envelope);
 const priorCloud=s.priorCloud===undefined?null:s.priorCloud;
 if(priorCloud!==null&&(typeof priorCloud!=='object'||typeof priorCloud.path!=='string'||!/^[a-f0-9]{64}$/.test(priorCloud.sha256)))throw Error('priorCloud must pin a volume recipe path and sha256');
 if(s.envelopeBaselineId!==undefined&&(!/^[a-f0-9]{64}$/.test(s.envelopeBaselineId)||s.envelopeBaselineId===s.baselineId||!envelopeSettings))throw Error('envelopeBaselineId must be a distinct pinned baseline used with envelope settings');
 if(s.fullChromaAlphaByte!==undefined&&(!Number.isFinite(s.fullChromaAlphaByte)||s.fullChromaAlphaByte<1||s.fullChromaAlphaByte>255))throw Error('fullChromaAlphaByte must be 1..255');
 // Authored display levels. The black quantile is the lowest footprint luma the fit will paint at all, so
 // with the long-standing 0.25 no recipe value can reach a halo that lives below the footprint's lower
 // luma quartile. Omitting the block keeps the long-standing 0.25 / 0.995 / 0.85 exactly.
 const levels=parseSimulationGuidedLevels(s.normalization);
 for(const e of s.exclusions)if(![e.x,e.y,e.rx,e.ry].every(Number.isFinite)||e.rx<=0||e.ry<=0||typeof e.reason!=='string')throw Error('Invalid explicit foreground exclusion');
 const baselineId=s.baselineId,baseline=resolve(root,'.local/nebula-lab/reconstructions',baselineId);
 await verifyFiniteMaterialArtifacts(baseline,`reconstruction-${baselineId}`);
 const provenanceBytes=await readFile(resolve(baseline,'source/provenance.json')),oldResultBytes=await readFile(resolve(baseline,'result.json'));
 const provenance=parseLabModelJson(provenanceBytes.toString()),oldResult=parseLabModelJson(oldResultBytes.toString()),work=provenance.request;
 if(provenance.schema!=='cssearth-nebula-reconstruction-provenance@1'||oldResult.resultId!==baselineId||work.cloud.modelPlacement)throw Error('Unsupported baseline geometry');
 await sourceBytes(root,work.source);await sourceBytes(root,work.cloud.slices);await sourceBytes(root,work.cloud.descriptor);
 const implementation=await implementationPins(root,['labs/nebula/packages/lab/src/cli/commands/simulation-guided-reconstruction.ts']);
 const identity={baseline:{resultId:baselineId,provenanceSha256:sha256(provenanceBytes),resultSha256:sha256(oldResultBytes)},settings:{path:relative(root,resolve(settingsPath)),sha256:sha256(settingsBytes)},implementation};
 const resultId=sha256(Buffer.from(JSON.stringify(identity))),id=`reconstruction-${resultId}`,output=resolve(root,'.local/nebula-lab/reconstructions',resultId),staging=output+'.pending';
 try{await readFile(resolve(output,'result.json'));await verifyFiniteMaterialArtifacts(output,id);console.log(JSON.stringify({resultId,output,cached:true}));return;}catch(e){if(!e||typeof e!=='object'||!('code'in e)||e.code!=='ENOENT')throw e;}
 await mkdir(staging);await cp(resolve(baseline,'source'),resolve(staging,'source'),{recursive:true});await rename(resolve(staging,'source/validation.json'),resolve(staging,'source/baseline-validation.json'));await mkdir(resolve(staging,'prepared'));
 const distance=provenance.geometry.observerDistanceKpc,A=angularScale(distance),tb=provenance.geometry.tangentBoundsKpc;
 const bounds:SkyBounds={min:[tb.min[0]*A,tb.min[1]*A],max:[tb.max[0]*A,tb.max[1]*A]};
 const width=s.width,height=Math.round(width*(bounds.max[1]-bounds.min[1])/(bounds.max[0]-bounds.min[0]));
 const rgb=await sharp(resolve(baseline,'source/registered-image.png')).resize(width,height,{fit:'fill'}).removeAlpha().raw().toBuffer();
 const rgba=await sharp(resolve(baseline,'source/original-image.png')).resize(width,height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const coverage=new Uint8Array(width*height),luma=new Float32Array(width*height),values:number[]=[];let excludedPixels=0;
 for(let p=0;p<coverage.length;p++){const x=(p%width+.5)/width,y=(Math.floor(p/width)+.5)/height;const excluded=s.exclusions.some((e:{x:number;y:number;rx:number;ry:number})=>((x-e.x)/e.rx)**2+((y-e.y)/e.ry)**2<=1);if(excluded)excludedPixels++;coverage[p]=rgba[p*4+3]>=250&&!excluded?1:0;luma[p]=Math.max(rgb[3*p],rgb[3*p+1],rgb[3*p+2])/255;if(coverage[p])values.push(luma[p]);}
 values.sort((a,b)=>a-b);if(!values.length)throw Error('No eligible image pixels');
 const q=(p:number)=>values[Math.min(values.length-1,Math.floor(values.length*p))]!,black=q(levels.blackQuantile),background=black+Math.max(.002,q(.5)-black)*s.backgroundSpread,white=q(levels.whiteQuantile);
 const target=luma.map((v,p)=>coverage[p]?Math.pow(Math.max(0,Math.min(2,(v-background)/Math.max(.03,white-background))),levels.gamma):0);
 // An alternative pinned density may carry the envelope: the same image registration, a different shape hypothesis.
 const prior=await loadSimulationPrior(root,priorCloud??work.cloud.provenance,distance,tb),priorBounds:EmissionBounds=prior.bounds;
 // An optional second registered image supplies only the broad envelope: deeper calibrated faint light, while
 // fine structure keeps the primary image. Both must be registered in the same observer frame and simulation.
 let envelopeSource:{id:string;provenanceSha256:string;imageId:unknown;target:Float32Array;coverage:Uint8Array;rgb:Buffer;normalization:Record<string,unknown>}|null=null;
 if(typeof s.envelopeBaselineId==='string'){
  const other=resolve(root,'.local/nebula-lab/reconstructions',s.envelopeBaselineId);
  await verifyFiniteMaterialArtifacts(other,`reconstruction-${s.envelopeBaselineId}`);
  const otherBytes=await readFile(resolve(other,'source/provenance.json')),otherProvenance=parseLabModelJson(otherBytes.toString()),otherWork=otherProvenance.request;
  for(const key of ['referenceFrame','epochJdTt','originM','localToReferenceXyzw','metersPerUnit'])if(JSON.stringify(otherWork.frame[key])!==JSON.stringify(work.frame[key]))throw Error('Envelope baseline observer frame differs: '+key);
  if(Math.abs(otherProvenance.geometry.observerDistanceKpc-distance)>1e-8||JSON.stringify(otherWork.cloud.provenance)!==JSON.stringify(work.cloud.provenance))throw Error('Envelope baseline must share the observer distance and pinned simulation');
  const otb=otherProvenance.geometry.tangentBoundsKpc;
  const decoded=await sharp(resolve(other,'source/registered-image.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=await sharp(resolve(other,'source/original-image.png')).resize(decoded.info.width,decoded.info.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  // Resample that image onto this fit grid through its own tangent registration, never a plain stretch.
  const otherRgb=Buffer.alloc(width*height*3),otherCoverage=new Uint8Array(width*height),otherLuma=new Float32Array(width*height),otherValues:number[]=[];
  for(let p=0;p<width*height;p++){
   const xArc=bounds.min[0]+(p%width+.5)*(bounds.max[0]-bounds.min[0])/width,yArc=bounds.max[1]-(Math.floor(p/width)+.5)*(bounds.max[1]-bounds.min[1])/height;
   const u=(xArc/A-otb.min[0])/(otb.max[0]-otb.min[0])*decoded.info.width-.5,v=(otb.max[1]-yArc/A)/(otb.max[1]-otb.min[1])*decoded.info.height-.5;
   if(u<0||v<0||u>decoded.info.width-1||v>decoded.info.height-1)continue;
   const ix=Math.min(decoded.info.width-2,Math.floor(u)),iy=Math.min(decoded.info.height-2,Math.floor(v)),fx=u-ix,fy=v-iy;
   let opaque=true;
   for(let c=0;c<3;c++){let value=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const q=(iy+dy)*decoded.info.width+ix+dx,w=(dx?fx:1-fx)*(dy?fy:1-fy);value+=decoded.data[q*3+c]!*w;if(alpha[q*4+3]!<250)opaque=false;}
    otherRgb[p*3+c]=Math.round(Math.min(255,Math.max(0,value)));}
   if(!opaque)continue;
   otherCoverage[p]=1;otherLuma[p]=Math.max(otherRgb[p*3]!,otherRgb[p*3+1]!,otherRgb[p*3+2]!)/255;otherValues.push(otherLuma[p]!);
  }
  otherValues.sort((a,b)=>a-b);if(otherValues.length<1000)throw Error('Envelope baseline covers too little of this fit grid');
  const oq=(f:number)=>otherValues[Math.min(otherValues.length-1,Math.floor(otherValues.length*f))]!,oBlack=oq(levels.blackQuantile),oBackground=oBlack+Math.max(.002,oq(.5)-oBlack)*s.backgroundSpread,oWhite=oq(levels.whiteQuantile);
  const otherTarget=otherLuma.map((v,p)=>otherCoverage[p]?Math.pow(Math.max(0,Math.min(2,(v-oBackground)/Math.max(.03,oWhite-oBackground))),levels.gamma):0);
  // Both displays are relative, so match this image's light scale to the primary target on their shared
  // coverage. Without it the envelope would be subtracted in another image's units.
  let sharedPrimary=0,sharedOther=0;
  for(let p=0;p<otherTarget.length;p++)if(coverage[p]&&otherCoverage[p]){sharedPrimary+=target[p]!;sharedOther+=otherTarget[p]!;}
  if(!(sharedOther>0)||!(sharedPrimary>0))throw Error('Envelope baseline shares no lit coverage with the primary image');
  const scale=sharedPrimary/sharedOther;
  for(let p=0;p<otherTarget.length;p++)otherTarget[p]*=scale;
  envelopeSource={id:s.envelopeBaselineId,provenanceSha256:sha256(otherBytes),imageId:otherWork.imageId,target:otherTarget,coverage:otherCoverage,rgb:otherRgb,
   normalization:{black:oBlack,background:oBackground,white:oWhite,gamma:levels.gamma,coveredPixels:otherValues.length,tangentBoundsKpc:otb,
    lightScaleToPrimary:scale,sharedCoverageLight:{primary:sharedPrimary,envelopeSource:sharedOther}}};
  console.log(JSON.stringify({phase:'envelope-source',imageId:otherWork.imageId,...envelopeSource.normalization}));
 }
 // Two scales: the simulation carries smoothed image light along its own depth; finite components fit only what remains.
 const envelope=envelopeSettings?fitSimulationEnvelope({target:envelopeSource?.target??target,coverage:envelopeSource?.coverage??coverage,width,height,bounds},prior,envelopeSettings):null;
 if(envelope)console.log(JSON.stringify({phase:'envelope',...envelope.metrics}));
 const detailTarget=envelope?target.map((v,p)=>coverage[p]?Math.max(0,v-envelope.projection[p]!):0):target;
 const fitted=fitSimulationGuidedEmission({target:detailTarget,coverage,width,height,bounds},s.controls,prior,s.depth,{onProgress:console.log});
 const chroma=envelopeSettings?envelopeChromaSettings(envelopeSettings):null;
 const envelopeAt=envelope?createEnvelopeSampler(envelope.grid,prior):null,envelopeColor=envelope&&envelopeSettings&&chroma?envelopeChromaticity(envelopeSource?.rgb??rgb,envelopeSource?.coverage??coverage,width,height,bounds,envelopeSettings.scalePixels,chroma.halfSaturationQuantile,chroma.skyQuantile,chroma.coverageTaper):null;
 const totalProjection=envelope?fitted.projection.map((v,p)=>v+envelope.projection[p]!):fitted.projection,totalResidual=totalProjection.map((v,p)=>coverage[p]?target[p]!-v:0);
 let squared=0,targetSquared=0;for(let p=0;p<target.length;p++)if(coverage[p]){squared+=totalResidual[p]!**2;targetSquared+=target[p]!**2;}
 const metrics={...fitted.metrics,detailOnly:!!envelope,totalRelativeSquaredError:targetSquared>0?squared/targetSquared:0,envelope:envelope?.metrics??null};
 const material=fitted.material({id:work.source.sha256,sampleRgb(x,y,out){const u=(x-bounds.min[0])/(bounds.max[0]-bounds.min[0])*width-.5,v=(bounds.max[1]-y)/(bounds.max[1]-bounds.min[1])*height-.5;if(u<0||v<0||u>width-1||v>height-1)return false;const ix=Math.floor(u),iy=Math.floor(v),p=iy*width+ix;if(!coverage[p])return false;for(let c=0;c<3;c++){out[c]=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)out[c]+=rgb[3*(Math.min(height-1,iy+dy)*width+Math.min(width-1,ix+dx))+c]*(dx?u-ix:1-u+ix)*(dy?v-iy:1-v+iy);}return true;}});
 const fieldBounds:EmissionBounds=envelope?{min:[Math.min(fitted.field.bounds.min[0],priorBounds.min[0]),Math.min(fitted.field.bounds.min[1],priorBounds.min[1]),Math.min(fitted.field.bounds.min[2],envelope.grid.zRange[0])],max:[Math.max(fitted.field.bounds.max[0],priorBounds.max[0]),Math.max(fitted.field.bounds.max[1],priorBounds.max[1]),Math.max(fitted.field.bounds.max[2],envelope.grid.zRange[1])]}:fitted.field.bounds;
 const physical=physicalBounds(fieldBounds,distance),span=physical.max.map((v,i)=>v-physical.min[i]!),pitch=Math.max(...span)/s.longestAxisSlabs;
 const sliceCounts={x:Math.max(4,Math.ceil(span[0]/pitch)),y:Math.max(4,Math.ceil(span[1]/pitch)),z:Math.max(4,Math.ceil(span[2]/pitch))};
 const sampleEmission=(x:number,y:number,z:number,out:Vector3)=>{const p=physicalToField([x,y,z],distance);fitted.sampleEmission(...p,out);const e=envelopeAt?envelopeAt(...p):0;for(let c=0;c<3;c++)out[c]=(out[c]!+e)*A;};
 const componentLight:Vector3=[0,0,0],componentColor:Vector3=[0,0,0],envelopeRgb:Vector3=[0,0,0];
 // Colour mixes component and envelope chromaticity by their local emission, matching compilerSlabMaterial's own weighting.
 const sampleMaterial=(x:number,y:number,z:number,out:Vector3)=>{const p=physicalToField([x,y,z],distance);if(!envelopeAt||!envelopeColor)return material.sampleMaterial(...p,out);
  fitted.sampleEmission(...p,componentLight);const ce=componentLight[0],ee=envelopeAt(...p),hasComponent=ce>0&&material.sampleMaterial(...p,componentColor),hasEnvelope=ee>0&&envelopeColor(p[0],p[1],envelopeRgb);
  const cw=hasComponent?ce:0,ew=hasEnvelope?ee:0;if(!(cw+ew>0))return false;for(let c=0;c<3;c++)out[c]=Math.min(255,Math.max(0,(cw*componentColor[c]!+ew*envelopeRgb[c]!)/(cw+ew)));return true;};
 const qualification={status:'research-experiment',materialGatePassed:false,reason:'Image-fitted finite emission with conditional stellar-simulation depths; not measured gas geometry. Visual review pending.'};
 const receipt={identity,settings:s,normalization:{signal:"relative RGB peak, not luminosity; consistent with peak-normalized component chromaticity",levels,black,background,white,gamma:levels.gamma,excludedPixels},metrics,physicalBounds:physical,sliceCounts,pitchKpc:pitch,minimumSigmaZKpc:Math.min(...fitted.field.components.map(c=>c.sigma[2]))/A,qualification};
 await json(resolve(staging,'source/simulation-guided.json'),receipt);await json(resolve(staging,'source/emission-field.json'),fitted.field);await json(resolve(staging,'source/depth-assignments.json'),fitted.depthAssignments);await json(resolve(staging,'source/component-material.json'),material.receipt);
 const raster=async(name:string,a:Float32Array)=>sharp(Buffer.from(a.map(v=>Math.round(255*(1-Math.exp(-Math.max(0,v)*s.exposureGain))))),{raw:{width,height,channels:1}}).png().toFile(resolve(staging,'source',name));
 await raster('aligned-image.png',totalProjection);await raster('fit-target.png',target);await raster('fit-projection.png',totalProjection);await raster('fit-residual.png',totalResidual.map(Math.abs));if(envelope){await raster('envelope-projection.png',envelope.projection);await raster('detail-target.png',detailTarget);await json(resolve(staging,'source/envelope.json'),{schema:'cssearth-simulation-envelope@1',settings:envelopeSettings,priorIdentity:prior.identity,priorCloud,source:envelopeSource?{resultId:envelopeSource.id,provenanceSha256:envelopeSource.provenanceSha256,imageId:envelopeSource.imageId,normalization:envelopeSource.normalization}:null,metrics:envelope.metrics,width:envelope.grid.width,height:envelope.grid.height,bounds:envelope.grid.bounds,zRange:envelope.grid.zRange,gain:Array.from(envelope.grid.gain,v=>Number(v.toPrecision(7)))});}
 console.log(JSON.stringify({resultId,phase:'bake',...receipt}));
 const neutral=await bakeMasterVolumeSlices({sampleEmission,boundsKpc:physical,sliceCounts,samplesPerSlab:s.samplesPerSlab,exposureGain:s.exposureGain,masterWidth:width,masterDirectory:resolve(staging,'masters'),deliveryBanks:[{width,outputDirectory:resolve(staging,'neutral'),imageEncoding:{format:'png'}}],unitsPerSourceUnit:1,provenance:receipt,onProgress:p=>{if(p.completed%24===0)console.log(`Neutral ${p.phase} ${p.completed}/${p.total}`);}});
 const painted=await recolorCloudSlices({slices:neutral.banks[0]!.slices,loadResource:path=>readFile(containedPath(resolve(staging,'neutral'),path)),sampleImageRgb:s.fullChromaAlphaByte===undefined?compilerSlabMaterial(sampleEmission,sampleMaterial):alphaLimitedSlabMaterial(compilerSlabMaterial(sampleEmission,sampleMaterial),sampleEmission,s.exposureGain,s.fullChromaAlphaByte),preserveMaterialIntensity:true,appearance:{saturation:1,detailStrength:0,detailScale:24,brightness:1,gamma:1},outputDirectory:resolve(staging,'prepared'),encoding:{format:'webp',quality:92},onProgress:p=>{if(p.completed%24===0)console.log(`Material ${p.completed}/${p.total}`);}});
 const validation={schema:'cssearth-simulation-guided-validation@1',baselineGeometryPreserved:false,baselineAlphaPreserved:false,neutralFitAlphaPreserved:true,alphaProof:'recolorCloudSlices checks every decoded delivery alpha byte against the newly baked neutral bank; mismatch throws before publication.',neutralSlices:neutral.banks[0]!.slices.quads.length,paintedSlices:painted.slices.quads.length,coverage:painted.coverage,projectionFit:metrics,depthHypothesis:s.depth.maximumModes===1?'Authored strongest conditional prior mode per finite feature, with complete image-fitted projected weight; not measured depth.':'Authored split among selected conditional prior modes; not measured depth.',visualGate:'pending-parent-review; no acceptance promotion'};
 await json(resolve(staging,'source/validation.json'),validation);
 const frame={...work.frame,boundsUnits:physical};
 const nextProvenance={...provenance,method:'simulation-guided-finite-emission@1',request:{...work,id,frame,outputDirectory:output},geometry:{...provenance.geometry,physicalBoundsKpc:physical},envelope:envelope?{path:'source/envelope.json',settings:envelopeSettings,metrics:envelope.metrics,priorCloud,source:envelopeSource?{resultId:envelopeSource.id,imageId:envelopeSource.imageId,meaning:'Broad envelope light and colour come from this separate registered image; fine structure comes from the primary baseline image.'}:null,meaning:'Smoothed image light carried along the pinned simulation density: gain(x,y) x simulation(x,y,z). Depth shape is the simulation, not recovered gas depth.'}:null,material:receipt,qualification,densityProjection:{width,height,tangentBoundsKpc:tb,observerDistanceKpc:distance,meaning:'Analytic integrated fitted finite emission, display optical-depth transfer 1-exp(-exposure*projection); not the original stellar prior.'},limitations:['A single optical image does not measure gas depth. Stellar simulation ray modes are conditional guidance only.',...(envelope?['The smooth envelope inherits the stellar simulation\'s depth distribution; it is a shape hypothesis, not measured gas geometry.']:[]),'Foreground exclusion and finite thickness limits are explicit authored settings.','Geometry and neutral opacity are newly fitted; color application alone preserves this new opacity.','Preview slab discretization and finite component chromaticity can lose sub-resolution image detail.'],validation};
 const provenanceSha=await json(resolve(staging,'source/provenance.json'),nextProvenance);painted.slices.provenance=nextProvenance;
 await json(resolve(staging,'prepared/volume-slices.json'),painted.slices);
 const data=compileCssVolume({id,frame,slices:painted.slices,recipe:{anchors:[]}}),prepared={schema:'cssearth-prepared-object@1',id,type:'density-volume',format:'cssearth-density-volume@1',data};
 const volumeSha=await json(resolve(staging,'prepared/volume.json'),prepared);
 const descriptor={schema:'cssearth-object@1',id,type:'density-volume',properties:{volume:frame,preparation:{source:'source/provenance.json'}},prepared:{format:prepared.format,url:'prepared/volume.json'}};
 await json(resolve(staging,'object.json'),descriptor);
 const referenceLeafIds=data.stacks.flatMap(stack=>stack.leaves.map(l=>l.id)),partLeafIds=referenceLeafIds.map(leaf=>'all-light::'+leaf);
 const inspection={...prepared,data:{...data,stacks:data.stacks.map(stack=>({...stack,leaves:stack.leaves.flatMap(l=>[l,{...l,id:'all-light::'+l.id}])}))}};
 const inspectionSha=await json(resolve(staging,'prepared/inspection.json'),inspection),partsSha=await json(resolve(staging,'source/cloud-parts.json'),{schema:'cssearth-cloud-parts@1',id,parts:[{id:'all-light',label:'Conditional finite emission',kind:'extended',signalFraction:1,defaultEnabled:true,leafIds:partLeafIds}],referenceLeafIds,composition:qualification.reason});
 await json(resolve(staging,'inspection-object.json'),{...descriptor,properties:{...descriptor.properties,preparation:{source:'source/cloud-parts.json'}},prepared:{format:prepared.format,url:'prepared/inspection.json'}});
 const local=relative(root,output),oldLocal=relative(root,baseline),subject=JSON.parse(JSON.stringify(oldResult.subject).replaceAll(oldLocal,local));subject.id=id;subject.name+=' · conditional emission';subject.directory=local;subject.modelNote=qualification.reason;subject.reconstructionImage={...subject.reconstructionImage,label:subject.reconstructionImage.label+' · finite emission',note:qualification.reason};
 await json(resolve(staging,'result.json'),{...oldResult,resultId,subject});
 const artifacts = await collectArtifacts(staging);await json(resolve(staging,'manifest.json'),{schema:'cssearth-nebula-reconstruction-artifacts@1',id,sourceSha256:work.source.sha256,artifacts});await verifyFiniteMaterialArtifacts(staging,id);await rename(staging,output);console.log(JSON.stringify({resultId,output,metrics,qualification}));
}
await main(process.argv[2]??'');
