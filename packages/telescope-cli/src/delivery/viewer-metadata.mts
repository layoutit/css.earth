/** Display fields retain their source owners; service identities are never instruments. */
import { readFile } from 'node:fs/promises';
import { requireArray, requireRecord } from '@cssearth/core';
import { localOutput } from '../products/verified-product.mts';

export async function deliveryDisplaySources(directory:string,files:readonly {path:string}[],header:unknown):Promise<Record<string,unknown>> {
  let parent:Record<string,unknown>|undefined,observation:Record<string,unknown>|undefined;
  for(const file of files.filter(file=>file.path.endsWith('/acquisition.json')||file.path==='acquisition.json')) {
    const record=requireRecord(JSON.parse(await readFile(localOutput(directory,file.path),'utf8')));
    if(record.stage!=='archive-acquisition')continue;
    const parameters=requireRecord(record.parameters);
    parent=requireRecord(parameters.parent);
    if(typeof parameters.acquisition==='string') {
      const acquisition=requireRecord(JSON.parse(parameters.acquisition));
      if(typeof acquisition.product==='string') {
        const product=requireRecord(JSON.parse(acquisition.product));
        observation=requireRecord(requireRecord(product.binding).observation);
      }
    }
  }
  let discovery:Record<string,unknown>|undefined;
  if(parent&&Object.keys(parent).length)for(const file of files.filter(file=>file.path.endsWith('.snapshot.json'))) {
    const snapshot=requireRecord(JSON.parse(await readFile(localOutput(directory,file.path),'utf8')));
    const rows=requireArray(requireRecord(snapshot.response).rows).map(row=>requireRecord(row));
    const matches=rows.filter(row=>Object.entries(parent!).every(([key,value])=>row[key]===value));
    if(matches.length>1)throw new TypeError('Ambiguous selected discovery metadata');
    if(matches.length===1)discovery=matches[0];
  }
  return {header,...(observation?{observation}:{}),...(discovery?{discovery}:{})};
}

export function viewerMetadata(receipt:object):Record<string,string> {
  const fields:Record<string,readonly string[]>={Instrument:['instrument','INSTRUME','instrument_name'],Date:['startIso','DATE-OBS','date','observationTime'],
    'Filter / band':['filter','FILTER','band','wavelengthsMicrometres','wavelengthMicrometres'],
    Scale:['pixelScale','s_pixel_scale','scale','angularResolutionArcsec'],Credit:['credit','credits','creditLine','attribution','ORIGIN']};
  const found:Record<string,string>={},priority:Record<string,number>={};
  const note=(label:string,key:string,item:unknown,owner:object)=>{
    const rank=fields[label]!.indexOf(key);if(rank<0||rank>=(priority[label]??Infinity))return;
    let text=typeof item==='string'?item.trim():typeof item==='number'&&Number.isFinite(item)?String(item):undefined;
    if(Array.isArray(item)&&item.length&&item.every(value=>typeof value==='number'&&Number.isFinite(value))) {
      text=item.join('–')+(key.includes('Micrometres')?' µm':'');
    }
    if(label==='Credit'&&Array.isArray(item)&&item.length&&item.every(value=>typeof value==='string'))text=item.join('; ');
    if(!text||label==='Instrument'&&/^\w+:\/\//u.test(text))return;
    if(key==='startIso'&&'endIso' in owner&&typeof owner.endIso==='string')text+=` – ${owner.endIso}`;
    if(key==='s_pixel_scale')text+=' arcsec/pixel';
    if(key==='angularResolutionArcsec')text+=' arcsec resolution';
    found[label]=text;priority[label]=rank;
  };
  const walk=(value:unknown,depth:number):void=>{
    if(depth>8||!value||typeof value!=='object')return;
    for(const [key,item]of Object.entries(value)) {
      for(const label of Object.keys(fields))note(label,key,item,value);
      if(key==='field'&&typeof item==='string'&&'value' in value)for(const label of Object.keys(fields))note(label,item.split(':').at(-1)!,value.value,value);
      walk(item,depth+1);
    }
  };
  // Measurement metadata comes from observed records, never requested constraints or software settings.
  if('parameters' in receipt&&receipt.parameters&&typeof receipt.parameters==='object') {
    const parameters=receipt.parameters;
    if('displaySources' in parameters)walk(parameters.displaySources,0);
    if('metadata' in parameters)walk(parameters.metadata,0);
    for(const [key,item]of Object.entries(parameters))for(const label of Object.keys(fields))note(label,key,item,parameters);
  }else walk(receipt,0);
  return Object.fromEntries(Object.keys(fields).map(label=>[label,found[label]??'Not recorded; see receipt']));
}
