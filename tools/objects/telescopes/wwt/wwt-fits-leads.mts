/** Curated target associations for WWT-hosted numeric FITS collections. They are leads, not field or detection checks. */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { sha256 } from '../../../../src/platform/sha256.mts';
import { requireArray, requireRecord, requireString } from '../../../sources/source-values.mts';
import type { TargetCatalogueEntry } from '../targets.mts';

export interface WwtFitsLead { readonly pick:number;readonly target:string;readonly catalog:string;readonly catalogSha256:string;
  readonly imageset:string;readonly bandPass:string;readonly evidence:string;readonly sourceUrl:string }
export type WwtFitsLeads = {readonly state:'indexed';readonly matches:readonly WwtFitsLead[];readonly scope:'WWT-hosted numeric FITS tiles; target association only; science metadata unresolved'}
  | {readonly state:'unavailable';readonly reason:string};

const catalogName=(value:unknown):string=>{
  const name=requireString(value,'WWT FITS catalog name');
  if(!/^[a-z0-9-]+-fits\.json$/u.test(name)||basename(name)!==name)throw new TypeError('Unsafe WWT FITS catalog name');
  return name;
};

export async function loadWwtFitsLeads(root:string,target:TargetCatalogueEntry):Promise<WwtFitsLeads>{
  try{
    const directory=resolve(root,'data/wwt'),index=requireRecord(JSON.parse(await readFile(resolve(directory,'fits-associations.json'),'utf8')),'WWT FITS associations');
    if(index.schema!=='cssearth-wwt-fits-associations@1')throw new TypeError('Unsupported WWT FITS association schema');
    const entries=requireArray(index.associations,'WWT FITS associations'),matches:WwtFitsLead[]=[],seen=new Set<string>();
    for(const raw of entries){
      const item=requireRecord(raw,'WWT FITS association'),id=requireString(item.target,'association target'),catalog=catalogName(item.catalog),
        imageset=requireString(item.imageset,'association imageset'),evidence=requireString(item.evidence,'association evidence');
      if(!id||!imageset||!/^https:\/\//u.test(evidence))throw new TypeError('WWT FITS association needs a target, imageset and HTTPS evidence');
      const key=`${id}\0${catalog}\0${imageset}`;if(seen.has(key))throw new TypeError('Duplicate WWT FITS association');seen.add(key);
      if(id!==target.id)continue;
      const bytes=await readFile(resolve(directory,catalog)),snapshot=requireRecord(JSON.parse(bytes.toString('utf8')),'WWT FITS catalog'),source=requireRecord(snapshot.source,'WWT FITS catalog source');
      if(snapshot.schema!=='cssearth-wwt-fits-catalog@1'||source.parser!=='wwt-data-formats@0.18.1')throw new TypeError('Unsupported WWT FITS catalog');
      const wtml=requireString(source.file,'WWT WTML filename');if(basename(wtml)!==wtml||!wtml.endsWith('.wtml'))throw new TypeError('Unsafe WWT WTML filename');
      if(sha256(await readFile(resolve(directory,wtml)))!==requireString(source.sha256,'WWT WTML digest'))throw new Error('WWT FITS catalog WTML pin changed');
      const rows=requireArray(snapshot.imagesets,'WWT FITS imagesets').map(row=>requireRecord(row,'WWT FITS imageset')).filter(row=>row.name===imageset);
      if(rows.length!==1)throw new TypeError(`WWT FITS association names ${rows.length} imagesets: ${imageset}`);
      const row=rows[0]!;
      matches.push({pick:matches.length+1,target:id,catalog,catalogSha256:sha256(bytes),imageset,bandPass:requireString(row.bandPass,'WWT band'),evidence,
        sourceUrl:requireString(source.url,'WWT WTML URL')});
    }
    return {state:'indexed',matches,scope:'WWT-hosted numeric FITS tiles; target association only; science metadata unresolved'};
  }catch(error){return {state:'unavailable',reason:error instanceof Error?error.message:String(error)};}
}

export async function resolveWwtFitsLead(root:string,explorationPath:string,pick:number):Promise<{readonly catalog:string;readonly imageset:string}>{
  const saved=requireRecord(JSON.parse(await readFile(explorationPath,'utf8')),'saved WWT exploration'),answer=requireRecord(saved.answer,'saved exploration answer');
  if(saved.schema!=='cssearth-telescope-exploration@1'||answer.target!==saved.target)throw new TypeError('Expected a saved exploration with one target');
  const listed=requireRecord(answer.wwtFits,'saved WWT FITS leads');
  if(listed.state!=='indexed')throw new TypeError('Saved exploration has no WWT FITS leads');
  const rows=requireArray(listed.matches,'saved WWT FITS choices');
  if(!Number.isSafeInteger(pick)||pick<1||pick>rows.length)throw new RangeError(`WWT FITS --pick must be between 1 and ${rows.length}`);
  const selected=requireRecord(rows[pick-1],'saved WWT FITS choice');
  if(selected.pick!==pick||selected.target!==saved.target)throw new TypeError('Saved WWT FITS choice identity changed');
  const fresh=await loadWwtFitsLeads(root,{id:requireString(saved.target,'target'),name:requireString(saved.target,'target'),aliases:[]});
  if(fresh.state!=='indexed')throw new Error(`WWT FITS associations unavailable: ${fresh.reason}`);
  const current=fresh.matches.find(row=>row.catalog===selected.catalog&&row.imageset===selected.imageset);
  if(!current||current.target!==selected.target||current.catalogSha256!==selected.catalogSha256||current.evidence!==selected.evidence||current.sourceUrl!==selected.sourceUrl||current.bandPass!==selected.bandPass)
    throw new Error('WWT FITS catalog or target association changed; explore again');
  return {catalog:resolve(root,'data/wwt',catalogName(current.catalog)),imageset:current.imageset};
}
