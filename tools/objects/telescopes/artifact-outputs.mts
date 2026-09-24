/** Inspect a verified artifact and name only the next outputs its present facts can support. */
import { readFile } from 'node:fs/promises';
import { sha256File } from '@cssearth/core/node';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { PRODUCT_RECORD_SCHEMA } from '../product-record.mts';
import { delivery, listOutputs as listDeliveryOutputs, type OutputChoice } from './outputs.mts';
import { validateProjectionSource } from './projection.mts';
import { verifiedProduct } from './verified-product.mts';
import { validateSphereSource } from './sphere/sphere.mts';
import { inspectSpatialObject } from './spatial-handoff.mts';
import { contextTarget, sourceContext } from './delivery-context.mts';
import type { FamilyOperation } from './family-handlers.mts';
import { verifiedExecutableFamilyOperations } from './family-operation.mts';
import { openPdsSource } from './pds-source.mts';
import { parseProductDescriptor } from './product-descriptor.mts';
import { assessSourceRelevance, readSourceQuestion, type SourceRelevance } from './source-relevance.mts';
import { recordedSourceProcessing, type SourceProcessingSoftware } from './source-product-contract.mts';
import type { ProductSoftware } from '../product-record.mts';

const unavailable = (kind:OutputChoice['kind'],reason:string):OutputChoice => ({kind,available:false,reason});
const available = (kind:OutputChoice['kind'],reason:string,parameters:readonly string[]=[]):OutputChoice => ({kind,available:true,reason,...(parameters.length?{parameters}:{})});
export interface ArtifactOutputInspection {readonly artifact:string;readonly target?:string;readonly source:unknown;readonly productReceipt?:string;readonly sourceContext?:ReturnType<typeof sourceContext>;readonly outputs:readonly OutputChoice[];readonly terminal?:boolean;readonly profiles?:readonly {readonly handlerId:string;readonly profileId:string}[];readonly issues?:readonly string[];readonly familyOperations?:readonly FamilyOperation[];readonly relevance?:SourceRelevance;readonly software?:readonly ProductSoftware[];readonly sourceProcessing?:readonly SourceProcessingSoftware[];readonly [key:string]:unknown}

export async function listArtifactOutputs(path:string,structure?:string):Promise<ArtifactOutputInspection>{
  const artifact=resolve(path),raw=requireRecord(JSON.parse(await readFile(artifact,'utf8')));
  if(raw.schema==='cssearth-telescope-local-import@1'){
    if(structure!==undefined)throw new TypeError('--structure does not select a local-import member.');
    const declarations=raw.declarations===undefined?undefined:requireRecord(raw.declarations,'import declarations');
    const profiles=requireArray(raw.proposedProfiles,'proposed profiles').map(value=>{const row=requireRecord(value,'proposed profile');return {handlerId:requireString(row.handlerId,'handler id'),profileId:requireString(row.profileId,'profile id')};});
    const issues=requireArray(raw.issues,'import issues').map(value=>requireString(requireRecord(value,'import issue').reason,'import issue reason'));
    if(raw.descriptor!==undefined){const descriptor=requireRecord(raw.descriptor,'qualified import descriptor'),relativePath=requireString(descriptor.path,'qualified descriptor path');if(relativePath!=='descriptor.json'||!Number.isSafeInteger(descriptor.bytes)||typeof descriptor.sha256!=='string')throw new TypeError('Qualified import descriptor pin is invalid.');const path=resolve(artifact,'..',relativePath),pin=await sha256File(path);if(pin.bytes!==descriptor.bytes||pin.sha256!==descriptor.sha256)throw new Error('Qualified import descriptor pin changed.');return {artifact:'local-import',...(typeof declarations?.target==='string'?{target:declarations.target}:{}),source:path,outputs:[],profiles,issues,familyOperations:await verifiedExecutableFamilyOperations(path)};}
    return {artifact:'local-import',...(typeof declarations?.target==='string'?{target:declarations.target}:{}),source:artifact,outputs:[],terminal:true,profiles,issues};
  }
  if(raw.schema==='cssearth-telescope-product-descriptor@1'){
    if(structure!==undefined)throw new TypeError('--structure does not select a descriptor component.');
    const dataset=requireRecord(raw.dataset,'descriptor dataset'),target=typeof dataset.target==='string'?dataset.target:undefined;
    return {artifact:'product-descriptor',...(target?{target}:{}),source:artifact,outputs:[],familyOperations:await verifiedExecutableFamilyOperations(artifact)};
  }
  if(raw.schema==='cssearth-telescope-delivery@1'||raw.schema==='cssearth-telescope-delivery@2'||raw.schema==='cssearth-telescope-delivery@3'){
    const delivered=await delivery(artifact),descriptorOutputs=delivered.producing.outputs.filter(output=>output.path.endsWith('/descriptor.json')||output.path==='descriptor.json');
    const facts=requireRecord(delivered.record.facts,'delivery facts');
    const familyDelivery=facts.kind==='table'||facts.kind==='spectrum'&&descriptorOutputs.length>0;
    if(familyDelivery&&structure!==undefined)throw new TypeError('--structure does not select a descriptor component.');
    const listed=familyDelivery?{target:delivered.target,source:artifact,sourceContext:delivered.context,outputs:[] as OutputChoice[],sourceMetadata:[]}:await listDeliveryOutputs(artifact,structure,delivered.sourceQuestion.position);
    const {sourceMetadata,...screen}=listed;
    const provenance={productReceipt:artifact,software:delivered.producing.software,sourceProcessing:recordedSourceProcessing(delivered.producing)};
    if(!descriptorOutputs.length)return{...screen,artifact:'delivery',...provenance,relevance:assessSourceRelevance(delivered.sourceQuestion,sourceMetadata,screen.outputs)};
    if(descriptorOutputs.length!==1)throw new TypeError('Delivery has an ambiguous family descriptor.');
    const output=descriptorOutputs[0]!,matches=delivered.files.filter(file=>file.bytes===output.bytes&&file.path.endsWith('/descriptor.json'));
    if(matches.length!==1)throw new TypeError('Delivery family descriptor is absent or ambiguous.');
    const descriptorPath=resolve(delivered.directory,matches[0]!.path);
    const descriptor=parseProductDescriptor(JSON.parse(await readFile(descriptorPath,'utf8')));
    return{...screen,artifact:'delivery',source:descriptorPath,...provenance,relevance:assessSourceRelevance(delivered.sourceQuestion,sourceMetadata,screen.outputs,descriptor),familyOperations:await verifiedExecutableFamilyOperations(descriptorPath)};
  }
  if(structure!==undefined&&raw.schema!==PRODUCT_RECORD_SCHEMA)throw new TypeError('--structure applies only to native delivery or OPUS PDS source inspection');
  if(raw.schema==='cssearth-physical-grid-volume@1'){
    const relativePath=requireString(raw.object,'physical grid volume object');
    if(relativePath!=='physical-volume/object.json')throw new TypeError('Physical grid volume points outside its owned output.');
    const product=await verifiedProduct(resolve(artifact,'..','output.product.json'));
    if(!product.record.outputs.some(output=>output.path===relativePath))throw new TypeError('Physical grid volume object is absent from its verified output closure.');
    const next=await listArtifactOutputs(resolve(artifact,'..',relativePath));
    return {...next,artifact:'physical-grid-volume',via:artifact};
  }
  if(raw.schema==='cssearth-object@1'){
    const type=raw.type,target=typeof raw.id==='string'?raw.id:'physical object';
    if(type!=='point-field'&&type!=='density-volume'&&type!=='volume-lens-bank')throw new TypeError('Object is not a supported physical point field, density volume or volume lens bank');
    const kind=type==='point-field'?'points':type==='density-volume'?'volume':'volume-lens-bank';let issue:string|undefined;
    try{await inspectSpatialObject(artifact);}catch(error){issue=error instanceof Error?error.message:String(error);}
    return {artifact:'physical-object',target,source:artifact,outputs:[
      kind==='points'?(issue?unavailable('points',`Physical point-field prerequisites are unavailable: ${issue}`):available('points','The existing prepared physical point field, renderer resources, frame, provenance and licence were verified.')):unavailable('points','This object is not a point field.'),
      kind==='volume'?(issue?unavailable('volume',`Physical density-volume prerequisites are unavailable: ${issue}`):available('volume','The existing prepared physical density volume, renderer resources, frame, provenance and licence were verified.')):unavailable('volume','This object is not a density volume.'),
      kind==='volume-lens-bank'?(issue?unavailable('volume-lens-bank',`Physical volume-lens-bank prerequisites are unavailable: ${issue}`):available('volume-lens-bank','The existing prepared physical volume lens bank, selectable grids, body attachment, renderer resources, frame and provenance were verified.')):unavailable('volume-lens-bank','This object is not a volume lens bank.')
    ]};
  }
  if(raw.schema!==PRODUCT_RECORD_SCHEMA)throw new TypeError('Expected a telescope delivery, product record, or supported physical object.json');
  const source=await verifiedProduct(artifact),stage=source.record.stage;
  const question=stage==='telescope-archive-source'||stage==='telescope-keck-source'?await readSourceQuestion(source.root):undefined;
  if(stage==='telescope-archive-source'){
    const descriptors=source.record.outputs.filter(output=>output.path==='descriptor.json');
    if(descriptors.length===1){
      const descriptorPath=resolve(source.root,'descriptor.json');
      const familyOperations=await verifiedExecutableFamilyOperations(descriptorPath);
      const descriptor=parseProductDescriptor(JSON.parse(await readFile(descriptorPath,'utf8')));
      return {artifact:stage,target:question!.target,source:descriptorPath,outputs:[],familyOperations,relevance:assessSourceRelevance(question!,[],[],descriptor)};
    }
    if(await openPdsSource(artifact)){
      const listed=await listDeliveryOutputs(artifact,structure);
      const {sourceMetadata,limitations,...screen}=listed;
      return {...screen,artifact:stage,target:question!.target,issues:(limitations??[]).filter(issue=>!screen.outputs.some(choice=>choice.limitations?.includes(issue))),
        relevance:assessSourceRelevance(question!,sourceMetadata??[],screen.outputs)};
    }
  }
  if(structure!==undefined)throw new TypeError('--structure applies only to native delivery or OPUS PDS source inspection');
  if(stage==='telescope-wwt-fits'||stage==='telescope-keck-source'||stage==='telescope-archive-source'&&source.record.parameters.fitsSource!==undefined||stage==='telescope-local-import'&&source.record.parameters.fitsSource!==undefined){
    if(structure!==undefined)throw new TypeError('--structure applies only to native delivery inspection');
    const listed=await listDeliveryOutputs(artifact,undefined,question?.position);
    const {sourceMetadata,limitations,...screen}=listed;
    return {...screen,artifact:stage,...(question?{target:question.target}:{}),issues:(limitations??[]).filter(issue=>!screen.outputs.some(choice=>choice.limitations?.includes(issue))),
      ...(question?{relevance:assessSourceRelevance(question,sourceMetadata??[],screen.outputs)}:{})};
  }
  if(stage==='telescope-archive-source')return {artifact:stage,target:question!.target,source:artifact,outputs:[],terminal:true,
    issues:['The original files are pinned, but no supported science output route recognizes this native product.'],
    relevance:assessSourceRelevance(question!,[],[])};
  if(stage==='telescope-source-output')return {artifact:stage,source:artifact,
    ...(typeof source.record.parameters.label==='string'?{target:source.record.parameters.label}:{}),outputs:[],terminal:true};
  if(stage==='telescope-output'){
    const context=sourceContext(source.record.parameters);
    let issue:string|undefined;try{await validateProjectionSource(source);}catch(error){issue=error instanceof Error?error.message:String(error);}
    return {artifact:stage,target:contextTarget(context),source:artifact,sourceContext:context,outputs:[
        issue?unavailable('body-map',`Body-map prerequisites are unavailable: ${issue}`):available('body-map','The verified 2D measurement can be registered with explicit navigation. Scientific publication remains a separate qualification.', ['geometry']),
        unavailable('sphere','A sphere requires a registered body map.'),
        unavailable('points','A telescope image or spectral cube does not establish physical depth.'),
        unavailable('volume','A telescope image or spectral cube does not establish physical depth.')
      ]};
  }
  if(stage==='body-map'){
    let checked:Awaited<ReturnType<typeof validateSphereSource>>|undefined,issue:string|undefined;
    try{checked=await validateSphereSource(source);}catch(error){issue=error instanceof Error?error.message:String(error);}
    return {artifact:stage,...(checked?{target:contextTarget(checked.context),sourceContext:checked.context}:{}),source:artifact,outputs:[
      issue?unavailable('sphere',`Sphere prerequisites are unavailable: ${issue}`):available('sphere','The body-map bundle and target standard sphere closure were verified.'),
      unavailable('body-map','This artifact is already a body map.')
    ]};
  }
  if(stage==='telescope-sphere'){const context=sourceContext(source.record.parameters);return {artifact:stage,target:contextTarget(context),source:artifact,sourceContext:context,outputs:[],terminal:true};}
  if(stage==='telescope-spatial-handoff')return {artifact:stage,...(typeof source.record.parameters.target==='string'?{target:source.record.parameters.target}:{}),source:artifact,outputs:[],terminal:true};
  if(stage==='telescope-family-operation')return{artifact:stage,...(typeof source.record.parameters.target==='string'?{target:source.record.parameters.target}:{}),source:artifact,outputs:[],terminal:true};
  throw new TypeError(`Product stage ${stage} has no public telescope output route`);
}
