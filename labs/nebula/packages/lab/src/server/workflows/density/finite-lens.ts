import { collectArtifacts } from './io.ts';
/** Finite component colors on one immutable conditional emission field. */
import {readFile,writeFile,mkdir,cp,rename} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import sharp from 'sharp';
import {parseLabModelJson} from '../../../resources/model-paths.ts';
import {implementationPins} from '../../services/implementation.ts';
import {compileCssVolume} from '../../../adapters/preparation/css-volume.ts';
import {verifyFiniteMaterialArtifacts} from '../../../cli/commands/finite-density-material-artifacts.ts';
import {physicalToField,angularScale} from '../../../cli/commands/simulation-guided-coordinates.ts';
import { createEmissionField, createEmissionMaterial, compilerSlabMaterial, lensChannelGainMaterial, validateChannelGain, validateLensToneCurve, type ChannelGain, type LensToneCurve, parseCloudAppearance, type CloudAppearance, type EmissionFieldModel, type VolumeSlices, type Vector3 } from '@cssearth/bake/volume';
import {createEnvelopeSampler,envelopeChromaticity,validateEnvelopeSettings,envelopeChromaSettings} from '@cssearth/nebula-reconstruction/methods/inference/simulation-envelope';
import {loadSimulationPrior} from '../../../cli/commands/simulation-prior.ts';
import { recolorCloudSlices, sourceBytes, containedPath } from '@cssearth/bake/volume/node';
import { sha256 } from '@cssearth/core/node';
import type {PreparedReconstruction} from '../../../features/reconstruction/reconstruction-types.ts';
export interface FiniteLensInput {modelResultId:string;sourceResultId:string;appearance?:CloudAppearance;
 /**
  * This lens's own per-channel material gain. Every lens of a shared finite geometry inherits that
  * geometry's single fitted alpha, so without it each lens is displayed at the model baseline's exposure
  * wearing only its own hue. The common factor is this lens's exposure against its own source image and
  * the ratios are its white balance. A relative display correction, never photometry.
  */
 channelGain?:readonly number[];
 /** This lens's fitted per-channel tone curve on analytic render level (`lens-tone-fit`); absent = none. */
 toneCurve?:unknown}
export interface FiniteLensProgress {stage:string;current:number;total:number;message:string}
const json=async(path:string,value:unknown)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,b);return sha256(b);};
export async function bakeFiniteLens(root:string,input:FiniteLensInput,signal?:AbortSignal,progress?:(p:FiniteLensProgress)=>void):Promise<PreparedReconstruction>{
 if(!/^[a-f0-9]{64}$/.test(input.modelResultId)||!/^[a-f0-9]{64}$/.test(input.sourceResultId))throw Error('Finite lenses require pinned reconstruction identities');
 const appearance=parseCloudAppearance(input.appearance);if(appearance.detailStrength!==0)throw Error('Finite component material does not support projected detail enhancement');
 const channelGain:ChannelGain|null=input.channelGain===undefined?null:validateChannelGain(input.channelGain);
 const toneCurve:LensToneCurve|null=input.toneCurve===undefined?null:validateLensToneCurve(input.toneCurve);
 const base=resolve(root,'.local/nebula-lab/reconstructions'),modelDir=resolve(base,input.modelResultId),sourceDir=resolve(base,input.sourceResultId);
 await verifyFiniteMaterialArtifacts(modelDir,`reconstruction-${input.modelResultId}`);await verifyFiniteMaterialArtifacts(sourceDir,`reconstruction-${input.sourceResultId}`);signal?.throwIfAborted();
 const modelBytes=await readFile(resolve(modelDir,'source/provenance.json')),sourceProvenanceBytes=await readFile(resolve(sourceDir,'source/provenance.json')),fieldBytes=await readFile(resolve(modelDir,'source/emission-field.json'));
 const model=parseLabModelJson(modelBytes.toString()),source=parseLabModelJson(sourceProvenanceBytes.toString()),oldResult=parseLabModelJson(await readFile(resolve(modelDir,'result.json'),'utf8')),sourceResult=parseLabModelJson(await readFile(resolve(sourceDir,'result.json'),'utf8'));
 if(model.method!=='simulation-guided-finite-emission@1'||source.method!=='alignment-density-material-v1')throw Error('Expected a finite emission model and registered source baseline');
 const work=source.request,frame=model.request.frame;
 for(const key of ['referenceFrame','epochJdTt','originM','localToReferenceXyzw','metersPerUnit'])if(JSON.stringify(frame[key])!==JSON.stringify(work.frame[key]))throw Error('Source and model observer frames differ: '+key);
 if(Math.abs(model.geometry.observerDistanceKpc-source.geometry.observerDistanceKpc)>1e-8)throw Error('Observer distances differ');
 await sourceBytes(root,work.source);await sourceBytes(root,work.original);
 const identity={method:'simulation-guided-finite-material@1',model:{resultId:input.modelResultId,provenanceSha256:sha256(modelBytes),fieldSha256:sha256(fieldBytes)},source:{resultId:input.sourceResultId,provenanceSha256:sha256(sourceProvenanceBytes)},appearance,...(channelGain?{channelGain}:{}),...(toneCurve?{toneCurve}:{}),implementation:await implementationPins(root,['labs/nebula/packages/lab/src/server/workflows/density/finite-lens.ts','labs/nebula/packages/lab/src/cli/commands/simulation-prior.ts'])};
 const resultId=sha256(Buffer.from(JSON.stringify(identity))),id=`reconstruction-${resultId}`,output=resolve(base,resultId),staging=output+'.pending';
 try{const r=parseLabModelJson(await readFile(resolve(output,'result.json'),'utf8'));await verifyFiniteMaterialArtifacts(output,id);return r;}catch(e){if(!e||typeof e!=='object'||!('code'in e)||e.code!=='ENOENT')throw e;}
 await mkdir(staging);await cp(resolve(modelDir,'source'),resolve(staging,'source'),{recursive:true});await mkdir(resolve(staging,'prepared'));await cp(resolve(modelDir,'neutral'),resolve(staging,'prepared/neutral'),{recursive:true});
 for(const name of ['original-image.png','original-overlay.json','registered-image.png','target.png'])await cp(resolve(sourceDir,'source',name),resolve(staging,'source',name));
 const decoded=await sharp(resolve(sourceDir,'source/registered-image.png')).removeAlpha().raw().toBuffer({resolveWithObject:true}),coverage=await sharp(resolve(sourceDir,'source/original-image.png')).resize(decoded.info.width,decoded.info.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 const {width,height}=decoded.info,rgb=decoded.data,bounds=source.geometry.tangentBoundsKpc,distance=model.geometry.observerDistanceKpc,A=angularScale(distance);
 const field=parseLabModelJson(fieldBytes.toString()) as EmissionFieldModel,preparedField=createEmissionField(field);
 const material=createEmissionMaterial(field,{id:work.source.sha256,sampleRgb(x,y,out){const tx=x/A,ty=y/A,u=(tx-bounds.min[0])/(bounds.max[0]-bounds.min[0])*width-.5,v=(bounds.max[1]-ty)/(bounds.max[1]-bounds.min[1])*height-.5;if(u<0||v<0||u>width-1||v>height-1)return false;const ix=Math.floor(u),iy=Math.floor(v);if(coverage[(iy*width+ix)*4+3]<250)return false;for(let c=0;c<3;c++){let value=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)value+=rgb[3*(Math.min(height-1,iy+dy)*width+Math.min(width-1,ix+dx))+c]*(dx?u-ix:1-u+ix)*(dy?v-iy:1-v+iy);
  // The four weights sum to one, so the result is inside the byte range; floating error can leave it a hair outside.
  out[c]=Math.min(255,Math.max(0,value));}return true;}},preparedField);
 // Two-scale models carry an envelope: the pinned simulation × a fixed gain map. Only its colour comes from this lens.
 const envelopeRecord=model.envelope?parseLabModelJson(await readFile(resolve(modelDir,'source/envelope.json'),'utf8')):null;
 let envelopeAt:((x:number,y:number,z:number)=>number)|null=null,envelopeColor:((x:number,y:number,out:Vector3)=>boolean)|null=null;
 if(envelopeRecord){
  const settings=validateEnvelopeSettings(envelopeRecord.settings),chroma=envelopeChromaSettings(settings),gw=envelopeRecord.width,gh=envelopeRecord.height;
  if(envelopeRecord.schema!=='cssearth-simulation-envelope@1'||!Number.isInteger(gw)||!Number.isInteger(gh)||!Array.isArray(envelopeRecord.gain)||envelopeRecord.gain.length!==gw*gh||!envelopeRecord.gain.every((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0))throw Error('Invalid simulation envelope record');
  // The model may have used an alternative pinned density; its envelope record owns that choice.
  const priorCloud=envelopeRecord.priorCloud??model.request.cloud.provenance;
  if(typeof priorCloud!=='object'||typeof priorCloud.path!=='string'||!/^[a-f0-9]{64}$/.test(priorCloud.sha256))throw Error('Invalid pinned envelope density');
  const prior=await loadSimulationPrior(root,priorCloud,distance,model.geometry.tangentBoundsKpc);
  if(prior.identity!==envelopeRecord.priorIdentity)throw Error('Simulation prior differs from the envelope it was fitted with');
  envelopeAt=createEnvelopeSampler({width:gw,height:gh,bounds:envelopeRecord.bounds,zRange:envelopeRecord.zRange,gain:Float32Array.from(envelopeRecord.gain)},prior);
  const lensRgb=await sharp(resolve(sourceDir,'source/registered-image.png')).resize(gw,gh,{fit:'fill'}).removeAlpha().raw().toBuffer(),lensAlpha=await sharp(resolve(sourceDir,'source/original-image.png')).resize(gw,gh,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const lensCoverage=Uint8Array.from({length:gw*gh},(_,p)=>lensAlpha[p*4+3]!>=250?1:0);
  envelopeColor=envelopeChromaticity(lensRgb,lensCoverage,gw,gh,envelopeRecord.bounds,settings.scalePixels,chroma.halfSaturationQuantile,chroma.skyQuantile,chroma.coverageTaper);
 }
 const sampleEmission=(x:number,y:number,z:number,out:Vector3)=>{const p=physicalToField([x,y,z],distance);preparedField.sampleEmission(...p,out);const e=envelopeAt?envelopeAt(...p):0;for(let c=0;c<3;c++)out[c]=(out[c]!+e)*A;};
 const componentLight:Vector3=[0,0,0],componentColor:Vector3=[0,0,0],envelopeRgb:Vector3=[0,0,0];
 const sampleMaterial=(x:number,y:number,z:number,out:Vector3)=>{const p=physicalToField([x,y,z],distance);if(!envelopeAt||!envelopeColor)return material.sampleMaterial(...p,out);
  preparedField.sampleEmission(...p,componentLight);const ce=componentLight[0],ee=envelopeAt(...p),hasComponent=ce>0&&material.sampleMaterial(...p,componentColor),hasEnvelope=ee>0&&envelopeColor(p[0],p[1],envelopeRgb);
  const cw=hasComponent?ce:0,ew=hasEnvelope?ee:0;if(!(cw+ew>0))return false;for(let c=0;c<3;c++)out[c]=Math.min(255,Math.max(0,(cw*componentColor[c]!+ew*envelopeRgb[c]!)/(cw+ew)));return true;};
 const modelSettings=model.material?.settings,fullChromaAlphaByte=modelSettings?.fullChromaAlphaByte;
 // The lens gain straddles the alpha chroma limit: white balance inside it, exposure outside it, so the
 // faint zone the limit neutralises stays neutral and no premultiplied 8-bit tint is painted over it.
 const alphaLimit=typeof fullChromaAlphaByte==='number'?fullChromaAlphaByte:undefined;
 // The tone curve is indexed by the model's own pinned front-projection byte at the texel's sky position:
 // the same analytic level the lens-levels measurement compares, read from a prepared artifact.
 let tone=null as Parameters<typeof lensChannelGainMaterial>[5];
 if(toneCurve){
  const grid=model.densityProjection;if(!grid||!Number.isInteger(grid.width)||!Number.isInteger(grid.height))throw Error('A tone curve needs the model\'s pinned projection grid');
  const pw=grid.width,ph=grid.height,pb=grid.tangentBoundsKpc,projection=await sharp(resolve(modelDir,'source/fit-projection.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(projection.info.width!==pw||projection.info.height!==ph)throw Error('Front projection differs from its pinned grid');
  const pc=projection.info.channels,pd=projection.data,at=(i:number,j:number)=>pd[(Math.min(ph-1,Math.max(0,j))*pw+Math.min(pw-1,Math.max(0,i)))*pc]!;
  tone={curve:toneCurve,levelAt(x,y,z){const p=physicalToField([x,y,z],distance),u=(p[0]/A-pb.min[0])/(pb.max[0]-pb.min[0])*pw-.5,v=(pb.max[1]-p[1]/A)/(pb.max[1]-pb.min[1])*ph-.5;
   if(u<-.5||v<-.5||u>pw-.5||v>ph-.5)return 0;const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j;
   return at(i,j)*(1-fu)*(1-fv)+at(i+1,j)*fu*(1-fv)+at(i,j+1)*(1-fu)*fv+at(i+1,j+1)*fu*fv;}};
 }
 const slabMaterial=lensChannelGainMaterial(compilerSlabMaterial(sampleEmission,sampleMaterial),sampleEmission,
  alphaLimit===undefined?1:modelSettings.exposureGain,alphaLimit,channelGain,tone);
 const neutral=parseLabModelJson(await readFile(resolve(modelDir,'neutral/volume-slices.json'),'utf8')) as VolumeSlices;
 const painted=await recolorCloudSlices({slices:neutral,loadResource:path=>readFile(containedPath(resolve(modelDir,'neutral'),path)),sampleImageRgb:slabMaterial,preserveMaterialIntensity:true,appearance,outputDirectory:resolve(staging,'prepared'),encoding:{format:'webp',quality:92},onProgress:p=>{signal?.throwIfAborted();progress?.({stage:'material',current:p.completed,total:p.total,message:`${work.imageId}: ${p.completed}/${p.total} finite material slices`});}});
 const validation={sameFiniteGeometry:true,sameNeutralAlpha:true,alphaProof:'Every decoded texture alpha byte compared with fixed neutral bank during recoloring.',coverage:painted.coverage};
 const provenance={...model,method:identity.method,finiteModel:identity.model,finiteMaterial:{modelResultId:input.modelResultId,sourceResultId:input.sourceResultId,channelGain,
  ...(toneCurve?{toneCurve,toneCurveMeaning:'Per-channel monotone curve fitted from paired pixels against this lens\'s own image, on the analytic render level (front-projection byte × chromaticity). Its channel ratios act as white balance inside the alpha chroma limit and its common factor after it. It can only dim or recolour inside the shared opacity; a display correction against a processed image, not photometry.'}:{}),channelGainMeaning:channelGain?'Per-channel multiplier on this lens\'s chromaticity: the common factor is its own exposure against its own source image, the ratios its white balance. The white balance is applied before the alpha chroma limit and the exposure after it, so the faint zone the limit neutralises stays neutral instead of taking a constant false tint. Alpha, density and geometry are unchanged; this is a relative display correction, not photometry.':'This lens is displayed at the shared model exposure with its own hue only.'},identity,request:{...model.request,id,outputDirectory:output,source:work.source,original:work.original,overlay:work.overlay,imageId:work.imageId,sourcePageUrl:work.sourcePageUrl,credit:work.credit},sourceRegistration:{frame:work.frame,tangentBoundsKpc:bounds,observerDistanceKpc:distance,baseline:input.sourceResultId},material:material.receipt,validation,qualification:{status:'research-experiment',materialGatePassed:false,reason:'Image colors attached to one shared finite inferred field; stellar simulation depths remain conditional, not measured gas geometry.'}};
 const provenanceSha=await json(resolve(staging,'source/provenance.json'),provenance);await json(resolve(staging,'source/validation.json'),validation);await json(resolve(staging,'source/component-material.json'),material.receipt);painted.slices.provenance=provenance;await json(resolve(staging,'prepared/volume-slices.json'),painted.slices);
 const packageBank=async(slices:VolumeSlices,name:string)=>{const data=compileCssVolume({id,frame,slices,recipe:{anchors:[]}}),prepared={schema:'cssearth-prepared-object@1',id,type:'density-volume',format:'cssearth-density-volume@1',data};const pin=await json(resolve(staging,`prepared/${name}.json`),prepared);const descriptor={schema:'cssearth-object@1',id,type:'density-volume',properties:{volume:frame,preparation:{source:'source/provenance.json'}},prepared:{format:prepared.format,url:`prepared/${name}.json`}};await json(resolve(staging,name==='volume'?'object.json':'neutral-object.json'),descriptor);return{data,prepared,descriptor};};
 const {data,prepared,descriptor}=await packageBank(painted.slices,'volume');
 const neutralForPrepared={...neutral,quads:neutral.quads.map(q=>({...q,texturePath:'neutral/'+q.texturePath}))};const neutralBank=await packageBank(neutralForPrepared,'neutral');
 const neutralInspection={...neutralBank.prepared,data:{...neutralBank.data,stacks:neutralBank.data.stacks.map(s=>({...s,leaves:s.leaves.flatMap(l=>[l,{...l,id:'all-light::'+l.id}])}))}};const neutralInspectionSha=await json(resolve(staging,'prepared/neutral.json'),neutralInspection);await json(resolve(staging,'neutral-object.json'),{...neutralBank.descriptor,prepared:{...neutralBank.descriptor.prepared}});
 const referenceLeafIds=data.stacks.flatMap(s=>s.leaves.map(l=>l.id)),partLeafIds=referenceLeafIds.map(leaf=>'all-light::'+leaf),inspection={...prepared,data:{...data,stacks:data.stacks.map(s=>({...s,leaves:s.leaves.flatMap(l=>[l,{...l,id:'all-light::'+l.id}])}))}};
 const inspectionSha=await json(resolve(staging,'prepared/inspection.json'),inspection),partsSha=await json(resolve(staging,'source/cloud-parts.json'),{schema:'cssearth-cloud-parts@1',id,parts:[{id:'all-light',label:'Finite emission',kind:'extended',signalFraction:1,defaultEnabled:true,leafIds:partLeafIds}],referenceLeafIds,composition:'One shared finite geometry across all image materials.'});
 await json(resolve(staging,'inspection-object.json'),{...descriptor,properties:{...descriptor.properties,preparation:{source:'source/cloud-parts.json'}},prepared:{format:prepared.format,url:'prepared/inspection.json'}});
 const local=relative(root,output),subject=JSON.parse(JSON.stringify(oldResult.subject).replaceAll(relative(root,modelDir),local));subject.id=id;subject.directory=local;subject.name=sourceResult.subject.name+' · finite material';subject.sourcePageUrl=work.sourcePageUrl;subject.credit=work.credit;subject.reconstructionImage={...oldResult.subject.reconstructionImage,label:sourceResult.subject.reconstructionImage.label+' · finite material',note:provenance.qualification.reason};subject.reconstructionNeutral={descriptor:'neutral-object.json'};subject.modelNote=provenance.qualification.reason;
 const result={...oldResult,resultId,finiteMaterial:{modelResultId:input.modelResultId,sourceResultId:input.sourceResultId,...(channelGain?{channelGain}:{}),...(toneCurve?{toneCurve}:{})},imageId:sourceResult.imageId,removalResultId:sourceResult.removalResultId,placement:sourceResult.placement,appearance,subject};await json(resolve(staging,'result.json'),result);
 const artifacts = await collectArtifacts(staging);await json(resolve(staging,'manifest.json'),{schema:'cssearth-nebula-reconstruction-artifacts@1',id,sourceSha256:work.source.sha256,artifacts});await verifyFiniteMaterialArtifacts(staging,id);signal?.throwIfAborted();await rename(staging,output);return result;
}
