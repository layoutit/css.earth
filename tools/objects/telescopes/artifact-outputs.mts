/** Inspect a verified artifact and name only the next outputs its present facts can support. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord } from '../../source-values.mts';
import { PRODUCT_RECORD_SCHEMA } from '../product-record.mts';
import { listOutputs as listDeliveryOutputs, type OutputChoice } from './outputs.mts';
import { localOutput, verifiedProduct } from './projection.mts';

const unavailable = (kind:OutputChoice['kind'],reason:string):OutputChoice => ({kind,available:false,reason});
const available = (kind:OutputChoice['kind'],reason:string,parameters:readonly string[]=[]):OutputChoice => ({kind,available:true,reason,...(parameters.length?{parameters}:{})});

export async function listArtifactOutputs(path:string,structure?:string){
  const artifact=resolve(path),raw=requireRecord(JSON.parse(await readFile(artifact,'utf8')));
  if(raw.schema==='cssearth-telescope-delivery@1')return {...await listDeliveryOutputs(artifact,structure),artifact:'delivery'};
  if(raw.schema==='cssearth-object@1'){
    const type=raw.type,target=typeof raw.id==='string'?raw.id:'physical object';
    if(type!=='point-field'&&type!=='density-volume')throw new TypeError('Object is not a supported physical point field or density volume');
    return {artifact:'physical-object',target,source:artifact,outputs:[
      type==='point-field'?available('points','Existing prepared physical point field; renderer resources, provenance and licence can be handed off.'):unavailable('points','This object is not a point field.'),
      type==='density-volume'?available('volume','Existing prepared physical density volume; renderer resources, provenance and licence can be handed off.'):unavailable('volume','This object is not a density volume.')
    ]};
  }
  if(raw.schema!==PRODUCT_RECORD_SCHEMA)throw new TypeError('Expected a telescope delivery, product record, or supported physical object.json');
  const source=await verifiedProduct(artifact),stage=source.record.stage;
  if(stage==='telescope-output'){
    const image=source.record.outputs.some(output=>output.path==='image.fits');
    return {artifact:stage,target:source.record.parameters.sourceRequest&&typeof source.record.parameters.sourceRequest==='object'?(source.record.parameters.sourceRequest as Record<string,unknown>).target:undefined,source:artifact,
      sourceSatisfaction:source.record.parameters.sourceSatisfaction,outputs:[
        image?available('body-map','The selected 2D measurement can be registered with explicit navigation. Scientific publication remains a separate qualification.', ['geometry']):unavailable('body-map','Only a 2D image measurement can be registered as a surface map.'),
        unavailable('sphere','A sphere requires a registered body map.'),
        unavailable('points','A telescope image or spectral cube does not establish physical depth.'),
        unavailable('volume','A telescope image or spectral cube does not establish physical depth.')
      ]};
  }
  if(stage==='body-map'){
    const required=['map.fits','map.fits.body-map.json','texture.png','poles.png','navigation.json'];
    const complete=required.every(path=>source.record.outputs.some(output=>output.path===path));
    const navigation=complete?source.record.outputs.find(output=>output.path==='navigation.json'):undefined;
    const nav=navigation?requireRecord(JSON.parse(await readFile(localOutput(source.root,navigation.path),'utf8'))):undefined;
    const request=nav?.sourceRequest&&typeof nav.sourceRequest==='object'?nav.sourceRequest as Record<string,unknown>:undefined;
    return {artifact:stage,target:request?.target,source:artifact,sourceSatisfaction:nav?.sourceSatisfaction,outputs:[
      complete?available('sphere','The registered body map can use its target standard sphere lane when that body package has complete embeddable closure.'):unavailable('sphere',`Sphere export needs the projection outputs ${required.filter(path=>!source.record.outputs.some(output=>output.path===path)).join(', ')}.`),
      unavailable('body-map','This artifact is already a body map.')
    ]};
  }
  if(stage==='telescope-sphere'||stage==='telescope-spatial-handoff')return {artifact:stage,target:source.record.parameters.target,source:artifact,sourceSatisfaction:source.record.parameters.sourceSatisfaction,outputs:[],terminal:true};
  throw new TypeError(`Product stage ${stage} has no public telescope output route`);
}
