/** Live ASCL software discovery. A catalog match is a citation lead, never evidence that code ran. */
import { readFile } from 'node:fs/promises';
import { sha256 } from '../../../src/platform/sha256.mts';
import { requireRecord, requireString } from '../../sources/source-values.mts';
import { verifiedProduct } from './projection.mts';
import { delivery } from './outputs.mts';
import { recordedSourceProcessing } from './source-products.mts';

export const ASCL_CATALOG = 'https://ascl.net/code/json';
const MAX_CATALOG_BYTES = 8 * 1024 * 1024;
const MAX_RESULTS = 20;
export interface AsclEntry { readonly id:string;readonly title:string;readonly url:string;readonly description?:string;readonly preferredCitation?:string;readonly codeSites:readonly string[] }
export interface AsclSoftwareMatch { readonly name:string;readonly version:string;readonly matches:readonly AsclEntry[] }
export interface AsclLookup { readonly source:string;readonly sourceSha256:string;readonly mode:'query'|'product';readonly query?:string;readonly product?:string;readonly entries?:readonly AsclEntry[];readonly software?:readonly AsclSoftwareMatch[];readonly sourceProcessing?:readonly (AsclSoftwareMatch & {readonly evidence:string})[];readonly caveat:string }

function entry(value:unknown):AsclEntry|null{
  const row=requireRecord(value,'ASCL catalog entry');
  const id=requireString(row.ascl_id,'ASCL id'),title=requireString(row.title,'ASCL title');
  if(!/^\d{4}\.\d{3}$/u.test(id)||id==='0000.000'||!title.trim())return null;
  const codeSites=Array.isArray(row.site_list)?row.site_list.filter((site):site is string=>typeof site==='string'&&/^https?:\/\//u.test(site)).slice(0,4):[];
  return {id,title,url:`https://ascl.net/${id}`,
    ...(typeof row.abstract==='string'&&row.abstract.trim()?{description:row.abstract.trim()}:{}),
    ...(typeof row.preferred_citation==='string'&&row.preferred_citation.trim()?{preferredCitation:row.preferred_citation.trim()}:{}),codeSites};
}
const normalize=(name:string):string=>name.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const shortTitle=(title:string):string=>title.split(':',1)[0]!.trim();

async function catalog(request:typeof fetch):Promise<{entries:AsclEntry[];sha256:string}>{
  const response=await request(ASCL_CATALOG,{signal:AbortSignal.timeout(45_000)});
  if(!response.ok||!response.body)throw new Error(`ASCL catalog HTTP ${response.status}`);
  const chunks:Uint8Array[]=[];let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>MAX_CATALOG_BYTES){await response.body.cancel().catch(()=>{});throw new Error('ASCL catalog exceeded the 8 MiB lookup limit');}chunks.push(chunk);}
  const body=Buffer.concat(chunks),parsed=requireRecord(JSON.parse(body.toString('utf8')),'ASCL catalog');
  return {entries:Object.values(parsed).map(entry).filter((item):item is AsclEntry=>item!==null),sha256:sha256(body)};
}

export async function searchAscl(query:string,request:typeof fetch=fetch):Promise<AsclLookup>{
  const term=normalize(query);
  if(term.length<2)throw new TypeError('ASCL query needs at least two letters or digits.');
  const found=await catalog(request);
  const matches=found.entries.filter(item=>normalize(item.title).includes(term)).sort((a,b)=>{
    const aFirst=normalize(shortTitle(a.title)).startsWith(term)?0:1,bFirst=normalize(shortTitle(b.title)).startsWith(term)?0:1;
    return aFirst-bFirst||a.title.localeCompare(b.title);
  }).slice(0,MAX_RESULTS);
  return {source:ASCL_CATALOG,sourceSha256:found.sha256,mode:'query',query,entries:matches,
    caveat:'ASCL lists research software. Search results do not show that code ran on a particular observation or that a target was detected.'};
}

export async function matchProductSoftware(product:string,request:typeof fetch=fetch):Promise<AsclLookup>{
  const raw=requireRecord(JSON.parse(await readFile(product,'utf8')),'software product');
  const record=typeof raw.schema==='string'&&raw.schema.startsWith('cssearth-telescope-delivery@')
    ?(await delivery(product)).producing:(await verifiedProduct(product)).record;
  const found=await catalog(request);
  const matches=(name:string)=>found.entries.filter(candidate=>normalize(shortTitle(candidate.title))===normalize(name)).slice(0,MAX_RESULTS);
  const software=record.software.map(item=>({name:item.name,version:item.version,
    matches:matches(item.name)}));
  const sourceProcessing=recordedSourceProcessing(record);
  return {source:ASCL_CATALOG,sourceSha256:found.sha256,mode:'product',product,software,
    ...(sourceProcessing.length?{sourceProcessing:sourceProcessing.map(item=>({...item,matches:matches(item.name)}))}:{}),
    caveat:'Verified receipts identify software recorded for the current run. Source-declared earlier processing is a separate authored claim with its own evidence. An exact ASCL title match is only a citation lead; it does not verify the software version, scientific fitness, or target detection. Unmatched names may still exist in ASCL.'};
}

export function formatAscl(result:AsclLookup):string{
  const lines=[`ASCL software lookup · ${result.mode==='query'?result.query:result.product}`,`Catalog: ${result.source}`,result.caveat];
  if(result.entries){for(const item of result.entries)lines.push(`${item.id} · ${item.title}\n  ${item.url}${item.preferredCitation?`\n  Preferred citation: ${item.preferredCitation}`:''}`);if(!result.entries.length)lines.push('No title matches in this catalog snapshot.');}
  if(result.software){for(const row of result.software)lines.push(`${row.name} (${row.version}): ${row.matches.length?row.matches.map(item=>`${item.id} ${item.url}`).join(', '):'no exact ASCL title match'}`);if(!result.software.length)lines.push('The verified product receipt lists no software.');}
  if(result.sourceProcessing?.length){lines.push('Source-declared earlier processing (not a current-run software receipt):');for(const row of result.sourceProcessing)lines.push(`${row.name} (${row.version}): ${row.matches.length?row.matches.map(item=>`${item.id} ${item.url}`).join(', '):'no exact ASCL title match'}\n  Evidence: ${row.evidence}`);}
  return `${lines.join('\n')}\n`;
}
