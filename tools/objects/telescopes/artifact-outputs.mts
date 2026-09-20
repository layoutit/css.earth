/** Inspect a verified artifact and name only the next outputs its present facts can support. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { PRODUCT_RECORD_SCHEMA } from '../product-record.mts';
import { listOutputs as listDeliveryOutputs, type OutputChoice } from './outputs.mts';
import { validateProjectionSource, verifiedProduct } from './projection.mts';
import { validateSphereSource } from './sphere.mts';
import { inspectSpatialObject } from './spatial-handoff.mts';
import { contextTarget, sourceContext } from './delivery-context.mts';
import type { FamilyOperation } from './family-handlers.mts';
import { executableFamilyOperations } from './family-operation.mts';

const unavailable = (kind:OutputChoice['kind'],reason:string):OutputChoice => ({kind,available:false,reason});
const available = (kind:OutputChoice['kind'],reason:string,parameters:readonly string[]=[]):OutputChoice => ({kind,available:true,reason,...(parameters.length?{parameters}:{})});

export async function listArtifactOutputs(path:string,structure?:string){
  const artifact=resolve(path),raw=requireRecord(JSON.parse(await readFile(artifact,'utf8')));
  if(raw.schema==='cssearth-telescope-local-import@1'){
    if(structure!==undefined)throw new TypeError('--structure does not select a local-import member.');
    const declarations=raw.declarations===undefined?undefined:requireRecord(raw.declarations,'import declarations');
    const profiles=requireArray(raw.proposedProfiles,'proposed profiles').map(value=>{const row=requireRecord(value,'proposed profile');return {handlerId:requireString(row.handlerId,'handler id'),profileId:requireString(row.profileId,'profile id')};});
    const issues=requireArray(raw.issues,'import issues').map(value=>requireString(requireRecord(value,'import issue').reason,'import issue reason'));
    return {artifact:'local-import',...(typeof declarations?.target==='string'?{target:declarations.target}:{}),source:artifact,outputs:[],terminal:true,profiles,issues};
  }
  if(raw.schema==='cssearth-telescope-product-descriptor@1'){
    if(structure!==undefined)throw new TypeError('--structure does not select a descriptor component.');
    const dataset=requireRecord(raw.dataset,'descriptor dataset'),target=typeof dataset.target==='string'?dataset.target:undefined;
    return {artifact:'product-descriptor',...(target?{target}:{}),source:artifact,outputs:[],familyOperations:executableFamilyOperations(raw)};
  }
  if(raw.schema==='cssearth-telescope-delivery@1'||raw.schema==='cssearth-telescope-delivery@2')return {...await listDeliveryOutputs(artifact,structure),artifact:'delivery'};
  if(structure!==undefined)throw new TypeError('--structure applies only to native delivery inspection');
  if(raw.schema==='cssearth-object@1'){
    const type=raw.type,target=typeof raw.id==='string'?raw.id:'physical object';
    if(type!=='point-field'&&type!=='density-volume')throw new TypeError('Object is not a supported physical point field or density volume');
    const kind=type==='point-field'?'points':'volume';let issue:string|undefined;
    try{await inspectSpatialObject(artifact);}catch(error){issue=error instanceof Error?error.message:String(error);}
    return {artifact:'physical-object',target,source:artifact,outputs:[
      kind==='points'?(issue?unavailable('points',`Physical point-field prerequisites are unavailable: ${issue}`):available('points','The existing prepared physical point field, renderer resources, frame, provenance and licence were verified.')):unavailable('points','This object is not a point field.'),
      kind==='volume'?(issue?unavailable('volume',`Physical density-volume prerequisites are unavailable: ${issue}`):available('volume','The existing prepared physical density volume, renderer resources, frame, provenance and licence were verified.')):unavailable('volume','This object is not a density volume.')
    ]};
  }
  if(raw.schema!==PRODUCT_RECORD_SCHEMA)throw new TypeError('Expected a telescope delivery, product record, or supported physical object.json');
  const source=await verifiedProduct(artifact),stage=source.record.stage;
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
    return {artifact:stage,target:checked?contextTarget(checked.context):undefined,source:artifact,...(checked?{sourceContext:checked.context}:{}),outputs:[
      issue?unavailable('sphere',`Sphere prerequisites are unavailable: ${issue}`):available('sphere','The body-map bundle and target standard sphere closure were verified.'),
      unavailable('body-map','This artifact is already a body map.')
    ]};
  }
  if(stage==='telescope-sphere'){const context=sourceContext(source.record.parameters);return {artifact:stage,target:contextTarget(context),source:artifact,sourceContext:context,outputs:[],terminal:true};}
  if(stage==='telescope-spatial-handoff')return {artifact:stage,target:source.record.parameters.target,source:artifact,outputs:[],terminal:true};
  throw new TypeError(`Product stage ${stage} has no public telescope output route`);
}
