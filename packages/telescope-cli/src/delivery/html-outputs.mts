/** Standalone HTML is a view of verified exported values, never a new science reduction. */
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { requireRecord, requireString } from '@cssearth/core';
import { OBJECT_SCHEMA, type ProductRecord } from '@cssearth/objects';
import { writeProductRecord, WORKSPACE } from '@cssearth/telescope-core/node';
import sharp from 'sharp';
import { VERSION } from '../help.mts';
import { CLI_PACKAGE_ROOT } from '../paths.mts';
import { verifiedProduct, localOutput } from '../products/verified-product.mts';
import { exportSphere } from '../sphere/sphere.mts';
import { assertStandaloneHtml } from '../sphere/html-policy.mts';
import { viewerDocument, escapeHtml } from './html-document.mts';
import { spectrumChart } from './spectrum-html.mts';
import { volumeMarkup, pointsMarkup } from '@cssearth/telescope/viewer/lane';
import { validateSpatialObject, exportSpatialObject } from './spatial-handoff.mts';
import { exportOutput, listOutputs } from './outputs.mts';

import { COMPOSITE_VOLUME_PLANNED } from './html-limits.mts';

function metadata(receipt: object): Record<string,string> {
  const fields: Record<string,string[]>={Instrument:['instrument','INSTRUME','telescope'],Date:['date','DATE-OBS','startIso','observationTime'], 'Filter / band':['filter','FILTER','band','wavelengthMicrometres'],Scale:['scale','pixelScale','angularResolutionArcsec','normalization'],Credit:['credit','credits','creditLine','attribution']};
  const found: Record<string,string>={},priority:Record<string,number>={};
  const note=(label:string,names:readonly string[],key:string,item:unknown)=>{const rank=names.indexOf(key);if(rank<0||item===undefined||item===null||rank>=(priority[label]??Infinity))return;priority[label]=rank;found[label]=typeof item==='string'?item:JSON.stringify(item);};
  const walk=(value:unknown,depth:number):void=>{
    if (depth>8||!value||typeof value!=='object') return;
    for (const [key,item] of Object.entries(value)) {
      for(const [label,names] of Object.entries(fields))note(label,names,key,item);
      if(key==='field'&&typeof item==='string'&&'value' in value)for(const [label,names]of Object.entries(fields))note(label,names,item,value.value);
      walk(item,depth+1);
    }
  };
  walk(receipt,0);
  return Object.fromEntries(Object.keys(fields).map(label=>[label,found[label]??'Not recorded; see receipt']));
}
export async function exportHtml(path: string, outputDirectory: string): Promise<{directory:string;html:string;receipt:string}> {
  const raw=requireRecord(JSON.parse(await readFile(path,'utf8')));
  if(raw.schema===OBJECT_SCHEMA) {
    if(raw.type!=='density-volume'&&raw.type!=='point-field')throw new TypeError(COMPOSITE_VOLUME_PLANNED);
    const handoff=await exportSpatialObject(path,raw.type==='point-field'?'points':'volume',outputDirectory);
    try{return await exportSpatialHtml(handoff.object,outputDirectory,(await verifiedProduct(handoff.receipt)).record,true);}
    catch(error){await rm(resolve(outputDirectory),{recursive:true,force:true});throw error;}
  }
  if(raw.schema==='cssearth-telescope-delivery@3') {
    const choices=await listOutputs(path), images=choices.outputs.filter(choice=>choice.kind==='image'&&choice.available&&choice.shape?.length===2);
    if(images.length!==1)throw new TypeError('HTML needs an unambiguous 2D image. Export an explicit image or spectrum selection first, then export its output.product.json with --output html.');
    const choice=images[0];
    const exported=await exportOutput(path,{kind:'image',hdu:choice.hdu!,...('structure' in choice&&choice.structure?{structure:choice.structure}:{})},outputDirectory);
    return writeMeasurementHtml(exported.receipt,outputDirectory);
  }
  const source=await verifiedProduct(path);
  if(source.record.stage==='body-map')return exportSphere(path,outputDirectory);
  if(source.record.stage==='telescope-spatial-handoff')return exportSpatialHtml(localOutput(source.root,'object.json'),outputDirectory,source.record);
  await mkdir(dirname(resolve(outputDirectory)),{recursive:true});await mkdir(resolve(outputDirectory));
  try { return await writeMeasurementHtml(path,outputDirectory); }
  catch(error){await rm(resolve(outputDirectory),{recursive:true,force:true});throw error;}
}
async function writeMeasurementHtml(path:string,outputDirectory:string) {
  const source=await verifiedProduct(path),{record}=source;
  if(!['telescope-output','telescope-source-output'].includes(record.stage))throw new TypeError(`No standalone HTML viewer for product stage ${record.stage}.`);
  const selection=requireRecord(record.parameters.selection),kind=selection.kind;
  const spectrum=kind==='spectrum'||kind==='aperture-spectrum',image=kind==='image'||kind==='band-image'||kind==='feature-map';
  if(!spectrum&&!image)throw new TypeError('HTML requires an exported image or spectrum.');
  const file=spectrum?'values.csv':'figure.png';
  if(!record.outputs.some(output=>output.path===file))throw new TypeError(`Receipt does not bind ${file}.`);
  const bytes=await readFile(localOutput(source.root,file));
  const context=record.parameters.sourceContext===undefined?undefined:requireRecord(record.parameters.sourceContext);
  const title=typeof record.parameters.label==='string'?record.parameters.label:typeof context?.target==='string'?context.target:record.telescope;
  let content:string;
  if(spectrum){
    const software=requireRecord(record.parameters.software),presentation=requireRecord(software.presentation),coordinates=requireRecord(presentation.coordinates);
    content=spectrumChart(bytes.toString(),typeof coordinates.valueUnit==='string'?coordinates.valueUnit:'unit not stated');
  }else{
    if((await sharp(bytes).metadata()).format!=='png')throw new TypeError('Image viewer requires the exported PNG.');
    content=`<img class="measurement-image" alt="${escapeHtml(title)}" src="data:image/png;base64,${bytes.toString('base64')}">`;
  }
  const css=image?'.measurement-image{width:100%;height:auto;image-rendering:pixelated}':'';
  const html=viewerDocument(`${title} · ${kind}`,content,record,metadata(record),css);assertStandaloneHtml(html);
  return writeHtmlProduct(outputDirectory,html,record.telescope,[{role:'source receipt',identity:source.file,bytes:source.pin.bytes},...record.outputs.map(output=>({role:'exported measurement',identity:localOutput(source.root,output.path),bytes:output.bytes}))],{kind,sourceReceipt:record});
}
async function exportSpatialHtml(path:string,outputDirectory:string,sourceReceipt?:ProductRecord,ownedDirectory=false) {
  const value=await validateSpatialObject(path,undefined);
  if(value.kind==='volume-dataset-bank'||value.kind==='volume'&&(value.payload.sky||value.payload.impostors))throw new TypeError(COMPOSITE_VOLUME_PLANNED);
  const manifest=requireString(requireRecord(value.descriptor.prepared).url);
  const css=value.kind==='points'?'':await readFile(WORKSPACE?resolve(WORKSPACE,'packages/renderer/src/styles/volume.css'):resolve(CLI_PACKAGE_ROOT,'data/renderer/volume.css'),'utf8');
  const embedded=new Map<string,string>();
  for(const resource of value.kind==='volume'?value.payload.resources:[]) {
    const key=relative(value.root,resolve(value.root,dirname(manifest),resource.path)),input=value.checked.get(key);
    if(!input)throw new TypeError(`Unverified volume resource ${resource.path}.`);
    const format=(await sharp(input.bytes).metadata()).format;
    if(!['png','webp','jpeg'].includes(format??''))throw new TypeError('Volume HTML requires prepared PNG, WebP or JPEG textures.');
    embedded.set(resource.path,`data:image/${format};base64,${input.bytes.toString('base64')}`);
  }
  const receipt={receipt:sourceReceipt,descriptor:value.descriptor,provenance:value.provenance,sourceRecords:Object.fromEntries([...value.checked].filter(([path])=>!path.startsWith('prepared/')).map(([path,item])=>[path,item.bytes.toString()]))};
  const markup=value.kind==='points'?pointsMarkup(value.payload):volumeMarkup(value.payload,path=>{const url=embedded.get(path);if(!url)throw new TypeError(`Unembedded volume texture ${path}.`);return url;});
  const html=viewerDocument(`${value.payload.id} · ${value.kind==='points'?'point field':'density volume'}`,markup,receipt,metadata(requireRecord(receipt)),css);assertStandaloneHtml(html);
  await mkdir(dirname(resolve(outputDirectory)),{recursive:true});if(!ownedDirectory)await mkdir(resolve(outputDirectory));
  try{return await writeHtmlProduct(outputDirectory,html,'css.earth physical source package',[{role:'physical descriptor',identity:value.source,bytes:value.bytes.length},...[...value.checked.values()].map(item=>item.pin)],{kind:value.kind,...receipt});}
  catch(error){await rm(resolve(outputDirectory),{recursive:true,force:true});throw error;}
}
async function writeHtmlProduct(directory:string,html:string,telescope:string,inputs:readonly {role:string;identity:string;bytes:number}[],parameters:Record<string,unknown>) {
  directory=resolve(directory);const file=resolve(directory,'viewer.html'),receipt=resolve(directory,'html.product.json');
  await writeFile(file,html);
  await writeProductRecord(receipt,{telescope,stage:'telescope-html',inputs,parameters,software:[{name:'css.earth standalone viewer',version:VERSION}]},[{path:'viewer.html',file}]);
  return {directory,html:file,receipt};
}
