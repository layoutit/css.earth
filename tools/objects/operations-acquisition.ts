import { sha256 } from '../../src/platform/sha256.mts';
import sharp from 'sharp';
import { lstat, readFile, mkdir, rename, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import {gzipSync} from 'node:zlib';
import { containedPath, declaredDownloadBytes, publishPinnedSource, publishPinnedSourceStream } from './operations.js';
import type { SourceManifest } from './operations.js';
import { assertRangeResponse, rangeRequestHeader } from '../../src/platform/source-manifest.mts';
import type { SourceEntry } from './operations.js';
import { sourceCacheUrl, withIdleTimeout } from '../assets/source-mirror.mts';
import {prepareSatelliteCatalog,validateSatelliteCatalogRecipe} from './acquisition/satellite-catalog.mts';
import {prepareDskMesh,validateDskMeshRecipe} from './acquisition/dsk-mesh.mts';
interface HriiFacets extends OperationBase {kind:'hrii-facets';path:string;recipePath:string;product:'fields'|'report';}
interface SpectralBandMaps extends OperationBase {kind:'spectral-band-maps';path:string;recipePath:string;product:string;}
interface MappedComposition extends OperationBase {kind:'mapped-composition';path:string;recipePath:string;product:string;}
interface DskMesh extends OperationBase {kind:'dsk-mesh';path:string;recipe:Record<string,unknown>;}
interface OperationBase { groups:string[]; }
interface Download extends OperationBase {kind:'download';path:string;url:string;headers?:Record<string,string>;encoding?:'gzip'|'pretty-json';expectedJsonFields?:Record<string,unknown>;}
interface RequestDownload extends OperationBase {kind:'request-download';path:string;url:string;form:Record<string,string>;fileSource?:string;trimEnd?:boolean;appendText?:string;headers?:Record<string,string>;replacements?:{pattern:string;flags?:string;replacement:string}[];requiredPrefix?:string;requiredText?:string[];numericLineCount?:number;}
interface JsonDocument extends OperationBase {kind:'json-document';path:string;value:Record<string,unknown>;}
interface ZipMember extends OperationBase {kind:'zip-member';path:string;url:string;member:string;}
interface SatelliteCatalog extends OperationBase {kind:'satellite-catalog';path:string;recipePath:string;headers?:Record<string,string>;}
interface VerifyDownload extends OperationBase {kind:'verify-download';url:string;}
interface Mosaic extends OperationBase {kind:'tile-mosaic';path:string;url:string;tileSize:number;columns:number;rows:number;dataWidth:number;dataHeight:number;width:number;height:number;forceRgb:boolean;concurrency:number;}
interface RequestCheck extends OperationBase {kind:'verify-request';url:string;form:Record<string,string>;fileSource?:string;expectedPath:string;selector:'trim'|'numeric-lines'|'before-marker';marker?:string;rowCount?:number;headers?:Record<string,string>;}
interface JsonCheck extends OperationBase {kind:'verify-json';url:string;expectedPath:string;fields:Record<string,string>;}
/** A pinned JPL Horizons time-list table asked for again; Horizons dates each response, so its rows are compared, not its bytes. */
interface HorizonsTimeList extends OperationBase {kind:'horizons-time-list';path:string;url:string;parameters:Record<string,string>;epochs:number[];}
export type AcquisitionOperation=MappedComposition|SpectralBandMaps|HriiFacets|DskMesh|Download|RequestDownload|JsonDocument|ZipMember|SatelliteCatalog|VerifyDownload|Mosaic|RequestCheck|JsonCheck|HorizonsTimeList;
export interface AcquisitionPlan {schema:'cssearth-acquisition-plan@1';operations:AcquisitionOperation[];}
export interface AcquisitionTransport { fetch(url:string,init?:RequestInit):Promise<Response>; }
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected acquisition object.');return value as Record<string,unknown>;};
export function parseAcquisitionPlan(value:unknown):AcquisitionPlan {
 // An empty plan is legal: a body whose every declared source input is already
 // tracked needs no reacquisition operation at all (e.g. eris, haumea, makemake).
 const plan=record(value);if(plan.schema!=='cssearth-acquisition-plan@1'||!Array.isArray(plan.operations))throw new TypeError('Invalid acquisition plan.');
 for(const value of plan.operations){const step=record(value);if(!['json-document','dsk-mesh','hrii-facets','spectral-band-maps','mapped-composition','satellite-catalog','zip-member'].includes(String(step.kind))&&(typeof step.url!=='string'||!/^https?:\/\//.test(step.url))||!Array.isArray(step.groups)||!step.groups.length||step.groups.some(group=>typeof group!=='string'))throw new TypeError('Acquisition URL or groups are missing.');
  if(!['download','request-download','json-document','dsk-mesh','hrii-facets','spectral-band-maps','mapped-composition','zip-member','satellite-catalog','verify-download','tile-mosaic','verify-request','verify-json','horizons-time-list'].includes(String(step.kind)))throw new TypeError('Unknown acquisition operator.');
  for(const key of ['path','expectedPath','fileSource','recipePath','member'])if(step[key]!==undefined){if(typeof step[key]!=='string')throw new TypeError('Invalid acquisition path.');containedPath('.',step[key]);}
  if(['download','request-download','json-document','dsk-mesh','hrii-facets','spectral-band-maps','mapped-composition','zip-member','satellite-catalog','tile-mosaic','horizons-time-list'].includes(String(step.kind)))if(typeof step.path!=='string')throw new TypeError('Acquisition destination is missing.');
  if(step.kind==='horizons-time-list'){const parameters=record(step.parameters);if(Object.values(parameters).some(value=>typeof value!=='string')||'TLIST' in parameters||!Array.isArray(step.epochs)||!step.epochs.length||step.epochs.some(epoch=>typeof epoch!=='number'||!Number.isFinite(epoch)))throw new TypeError('Invalid Horizons time list.');}
  if(step.kind==='zip-member'&&(typeof step.url!=='string'||!/^https:\/\//.test(step.url)||typeof step.member!=='string'||!/^[A-Za-z0-9_./-]+$/.test(step.member)||step.member.startsWith('-')))throw new TypeError('Invalid ZIP member.');
  if(step.headers!==undefined){const headers=record(step.headers);if(Object.values(headers).some(value=>typeof value!=='string'))throw new TypeError('Acquisition headers must be text.');}
  if(step.kind==='request-download'||step.kind==='verify-request'){const form=record(step.form);if(Object.values(form).some(value=>typeof value!=='string'))throw new TypeError('Acquisition form values must be text.');}
  if(step.kind==='request-download'&&(step.trimEnd!==undefined&&typeof step.trimEnd!=='boolean'||step.appendText!==undefined&&typeof step.appendText!=='string'))throw new TypeError('Invalid response text transformation.');
  if(step.kind==='download'&&step.encoding!==undefined&&!['gzip','pretty-json'].includes(String(step.encoding)))throw new TypeError('Unknown source download encoding.');
  if(step.kind==='download'&&step.expectedJsonFields!==undefined)record(step.expectedJsonFields);
  if(step.kind==='request-download'&&(step.requiredPrefix!==undefined&&typeof step.requiredPrefix!=='string'||step.requiredText!==undefined&&(!Array.isArray(step.requiredText)||step.requiredText.some(value=>typeof value!=='string'))||step.numericLineCount!==undefined&&(!Number.isSafeInteger(step.numericLineCount)||Number(step.numericLineCount)<1)))throw new TypeError('Invalid source response checks.');
  if(step.kind==='request-download'&&step.replacements!==undefined){if(!Array.isArray(step.replacements))throw new TypeError('Response replacements must be an array.');for(const value of step.replacements){const replacement=record(value);if(typeof replacement.pattern!=='string'||typeof replacement.replacement!=='string'||replacement.flags!==undefined&&(typeof replacement.flags!=='string'||!/^[gimu]*$/.test(replacement.flags)))throw new TypeError('Invalid response text replacement.');new RegExp(replacement.pattern,replacement.flags as string|undefined);}}
  if(step.kind==='json-document')record(step.value);
  if(step.kind==='hrii-facets'&&(typeof step.recipePath!=='string'||!['fields','report'].includes(String(step.product))))throw new TypeError('Invalid HRII facet acquisition.');
  if(['spectral-band-maps','mapped-composition'].includes(String(step.kind))&&(typeof step.recipePath!=='string'||typeof step.product!=='string'||!/^[a-z][a-z0-9-]*$/.test(step.product)))throw new TypeError('Invalid numeric-map acquisition.');
  if(step.kind==='dsk-mesh')validateDskMeshRecipe(step.recipe);
  if(step.kind==='satellite-catalog'&&typeof step.recipePath!=='string')throw new TypeError('Satellite catalog recipe is missing.');
  if(step.kind==='tile-mosaic')for(const key of ['tileSize','columns','rows','dataWidth','dataHeight','width','height','concurrency'])if(typeof step[key]!=='number'||!Number.isSafeInteger(step[key])||step[key]<=0)throw new TypeError(`Invalid mosaic ${key}.`);
  if(step.kind==='verify-request'){record(step.form);if(typeof step.expectedPath!=='string'||!['trim','numeric-lines','before-marker'].includes(String(step.selector)))throw new TypeError('Invalid source response comparator.');if(step.selector==='before-marker'&&typeof step.marker!=='string')throw new TypeError('Source marker is missing.');}
  if(step.kind==='verify-json')record(step.fields);
 }
 return plan as unknown as AcquisitionPlan;
}

// The mirror is opt-in (default null): a caller must name RUNTIME_ASSET_ORIGIN explicitly to use it. Defaulting to
// it here would make every caller — including a test that only wired up its own `transport` — silently also try a
// real request to the production mirror URL, which a narrowly-scoped mock's URL assertion then rejects.
const rangeHeaders=(entry:SourceEntry,headers?:Record<string,string>)=>entry.range?{...headers,Range:rangeRequestHeader(entry.range)}:headers;
const rangedEntry=(manifest:SourceManifest,path:string)=>[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].some(entry=>entry.path===path&&entry.range!==undefined);
export async function executeAcquisition({sourceRoot,manifest,plan,group='refresh',transport={fetch},mirrorOrigin=null,objectId=basename(dirname(sourceRoot))}:{sourceRoot:string;manifest:SourceManifest;plan:AcquisitionPlan;group?:string;transport?:AcquisitionTransport;mirrorOrigin?:string|null;objectId?:string}) {
 const selected=plan.operations.filter(step=>step.groups.includes(group));if(!selected.length)throw new Error(`Acquisition group ${group} is undeclared.`);
 const request=async(url:string,init?:RequestInit)=>{const response=await transport.fetch(url,init);if(!response.ok)throw new Error(`Source request failed ${response.status}: ${url}.`);return response;};
 const bytes=async(url:string)=>new Uint8Array(await(await request(url)).arrayBuffer());
 const publish=async(path:string,data:Uint8Array)=>{const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===path);if(!entry)throw new Error(`Undeclared acquisition target: ${path}.`);return publishPinnedSource({sourceRoot,entry,bytes:data});};
 // Attempt every step so one unreachable host does not hide the others; report all failures together.
 const hriiResults=new Map<string,Awaited<ReturnType<typeof import('./terrestrial-layers/hrii-facets.mts').prepareHriiFacets>>>();
 const spectralResults=new Map<string,Awaited<ReturnType<typeof import('./observation/spectral-band-maps.mts').prepareSpectralBandMaps>>>();
 const compositionResults=new Map<string,Awaited<ReturnType<typeof import('./acquisition/mapped-composition.mts').prepareMappedComposition>>>();
 const failures:{step:(typeof selected)[number];error:unknown}[]=[];
 for(const step of selected){
  try{
  if(step.kind==='download'){
   if(!step.encoding){
    const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===step.path);if(!entry)throw new Error(`Undeclared acquisition target: ${step.path}.`);
    // Try our own content-addressed mirror first, through the same injected transport as the publisher (so tests
    // never reach the real network): reliable storage, streamed straight into the pinned-write path, which holds the
    // answer to its declared size before ever touching the real destination. A miss, a non-OK response, an idle
    // stall or a size drift there all surface as a rejected publishPinnedSourceStream and fall back to the publisher
    // URL, which stays the recorded provenance either way. Streaming (not buffering) means a >20 MB input costs no
    // more memory here than the publisher path already does.
    let usedMirror=false;
    // The mirror is addressed by object and manifest path.
    if(mirrorOrigin){
     const mirrorUrl=sourceCacheUrl(mirrorOrigin,objectId,step.path);
     try{
      const response=await transport.fetch(mirrorUrl);
      if(response.ok&&response.body){
       await publishPinnedSourceStream({sourceRoot,entry,stream:withIdleTimeout(Readable.fromWeb(response.body as never),8000),
        declaredBytes:declaredDownloadBytes(entry,response)});
       usedMirror=true;
      }
     }catch{/* fall through to the publisher below */}
    }
    if(!usedMirror){
     const response=await request(step.url,{headers:rangeHeaders(entry,step.headers)});if(!response.body)throw new Error(`Source download has no body: ${step.url}.`);
     if(entry.range)assertRangeResponse(response,entry.range,step.url);
     await publishPinnedSourceStream({sourceRoot,entry,stream:withIdleTimeout(Readable.fromWeb(response.body as never),120000),
      declaredBytes:declaredDownloadBytes(entry,response)});
    }
    continue;
   }
   if(rangedEntry(manifest,step.path))throw new Error(`A ranged source cannot be re-encoded on acquisition: ${step.path}.`);
   let data=new Uint8Array(await(await request(step.url,{headers:step.headers})).arrayBuffer());
   if(step.encoding==='gzip')data=gzipSync(data,{level:9});
   if(step.encoding==='pretty-json'){const value=JSON.parse(new TextDecoder().decode(data)) as unknown;for(const[key,expected]of Object.entries(step.expectedJsonFields??{})){let actual=value;for(const part of key.split('.'))actual=record(actual)[part];if(actual!==expected)throw new Error(`Source JSON identity ${key} drifted.`);}data=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');}
   await publish(step.path,data);
  }
  else if(step.kind==='zip-member'){
   const cache=resolve('.local/source-archives');await mkdir(cache,{recursive:true});
   // The archive is cached by its URL; a complete download is kept until the cache is cleared.
   const archivePath=resolve(cache,`${sha256(new TextEncoder().encode(step.url))}.zip`);
   if(!await lstat(archivePath).then(info=>info.isFile()&&info.size>0,()=>false)){
    const response=await request(step.url);if(!response.body)throw new Error('ZIP download has no body.');
    const temporary=`${archivePath}.partial-${process.pid}`;
    try{await pipeline(Readable.fromWeb(response.body as never),createWriteStream(temporary));await rename(temporary,archivePath);}finally{await rm(temporary,{force:true});}
   }
   const {stdout}=await promisify(execFile)('unzip',['-p',archivePath,step.member],{encoding:'buffer',maxBuffer:512*1024*1024});
   await publish(step.path,stdout);
  }
  else if(step.kind==='hrii-facets'){
   let result=hriiResults.get(step.recipePath);
   if(!result){const {prepareHriiFacets}=await import('./terrestrial-layers/hrii-facets.mts');result=await prepareHriiFacets(sourceRoot,step.recipePath);hriiResults.set(step.recipePath,result);}
   await publish(step.path,step.product==='fields'?result.bytes:new TextEncoder().encode(JSON.stringify(result.report,null,2)+'\n'));
  }
  else if(step.kind==='spectral-band-maps'){
   let result=spectralResults.get(step.recipePath);
   if(!result){const {prepareSpectralBandMaps}=await import('./observation/spectral-band-maps.mts');result=await prepareSpectralBandMaps(sourceRoot,step.recipePath);spectralResults.set(step.recipePath,result);}
   const bytes=step.product==='report'?new TextEncoder().encode(JSON.stringify(result.report,null,2)+'\n'):result.products[step.product];
   if(!bytes)throw new Error(`Unknown spectral band map ${step.product}.`);
   await publish(step.path,bytes);
  }
  else if(step.kind==='mapped-composition'){
   let result=compositionResults.get(step.recipePath);
   if(!result){const {prepareMappedComposition}=await import('./acquisition/mapped-composition.mts');result=await prepareMappedComposition(sourceRoot,step.recipePath);compositionResults.set(step.recipePath,result);}
   const data=step.product==='report'?new TextEncoder().encode(JSON.stringify(result.report,null,2)+'\n'):result.products[step.product];
   if(!data)throw new Error(`Unknown mapped composition product ${step.product}.`);
   await publish(step.path,data);
  }
  else if(step.kind==='dsk-mesh')await publish(step.path,await prepareDskMesh({sourceRoot,recipe:step.recipe}));
  else if(step.kind==='json-document')await publish(step.path,new TextEncoder().encode(JSON.stringify(step.value,null,2)+'\n'));
  else if(step.kind==='satellite-catalog'){
   const recipe=JSON.parse(await readFile(containedPath(sourceRoot,step.recipePath),'utf8')) as unknown,config=validateSatelliteCatalogRecipe(recipe),documents:Record<string,string>={};
   for(const[id,url]of Object.entries(config.sources))documents[id]=await(await request(url,{headers:step.headers})).text();
   await publish(step.path,new TextEncoder().encode(JSON.stringify(prepareSatelliteCatalog({config:recipe,documents}),null,2)+'\n'));
  }
  else if(step.kind==='request-download'){
   const form={...step.form};if(step.fileSource)form.file=await readFile(containedPath(sourceRoot,step.fileSource),'utf8');
   let text=await(await request(step.url,{method:'POST',headers:step.headers,body:new URLSearchParams(form)})).text();
   if(step.requiredPrefix!==undefined&&!text.startsWith(step.requiredPrefix)||step.requiredText?.some(value=>!text.includes(value))||step.numericLineCount!==undefined&&text.split('\n').filter(line=>/^\d/.test(line)).length!==step.numericLineCount)throw new Error('Source response shape drifted.');
   for(const replacement of step.replacements??[])text=text.replace(new RegExp(replacement.pattern,replacement.flags),replacement.replacement);
   if(step.trimEnd)text=text.trimEnd();if(step.appendText!==undefined)text+=step.appendText;
   await publish(step.path,new TextEncoder().encode(text));
  }
  else if(step.kind==='horizons-time-list'){
   const [{timeListRows},{horizonsRows}]=await Promise.all([import('./sphere-horizons.mts'),import('./terrestrial-layers/observer-cameras.mts')]);
   const asked=await timeListRows(step.url,step.parameters,step.epochs,async url=>(await request(url)).text());
   const pinned=horizonsRows(await readFile(containedPath(sourceRoot,step.path),'utf8'));
   if(asked.length!==pinned.length||asked.some((row,index)=>row!==pinned[index]))throw new Error(`Horizons rows drifted from ${step.path}.`);
  }
  else if(step.kind==='verify-download'){if(!(await bytes(step.url)).length)throw new Error(`Upstream source is empty: ${step.url}.`);}
  else if(step.kind==='verify-json'){const expected=record(JSON.parse(await readFile(containedPath(sourceRoot,step.expectedPath),'utf8')) as unknown),actual=record(await(await request(step.url)).json());for(const [remote,local] of Object.entries(step.fields))if(actual[remote]!==expected[local])throw new Error(`Source identity field ${remote} drifted.`);}
  else if(step.kind==='verify-request'){
   const form={...step.form};if(step.fileSource)form.file=await readFile(containedPath(sourceRoot,step.fileSource),'utf8');
   let actual=await(await request(step.url,{method:'POST',headers:step.headers,body:new URLSearchParams(form)})).text(),expected=await readFile(containedPath(sourceRoot,step.expectedPath),'utf8');
   if(step.selector==='numeric-lines'){const extract=(text:string)=>{const rows=text.split('\n').filter(line=>/^\d/.test(line));if(step.rowCount!==undefined&&rows.length!==step.rowCount)throw new Error('Spectrum sample count drifted.');return rows.join('\n');};actual=extract(actual);expected=extract(expected);}
   else if(step.selector==='before-marker'){if(!step.marker||!expected.includes(step.marker))throw new Error('Source comparison marker is missing.');expected=expected.split(step.marker)[0].trimEnd();actual=actual.trimEnd();}
   else {actual=actual.trimEnd();expected=expected.trimEnd();}
   if(actual!==expected)throw new Error(`Source response drifted from ${step.expectedPath}.`);
  }else if(step.kind==='tile-mosaic'){
   const tiles=Array.from({length:step.rows*step.columns},(_,index)=>({x:index%step.columns,y:Math.floor(index/step.columns)}));
   const inputs:{input:Buffer;left:number;top:number}[]=[];
   for(let offset=0;offset<tiles.length;offset+=step.concurrency)await Promise.all(tiles.slice(offset,offset+step.concurrency).map(async({x,y})=>{inputs.push({input:Buffer.from(await bytes(step.url.replaceAll('${x}',String(x)).replaceAll('${y}',String(y)))),left:x*step.tileSize,top:y*step.tileSize});}));
   inputs.sort((a,b)=>a.top-b.top||a.left-b.left);
   const stitched=await sharp({create:{width:step.columns*step.tileSize,height:step.rows*step.tileSize,channels:3,background:{r:0,g:0,b:0}}}).composite(inputs).png().toBuffer();
   let image=sharp(stitched).extract({left:0,top:0,width:step.dataWidth,height:step.dataHeight});if(step.dataWidth!==step.width||step.dataHeight!==step.height)image=image.resize(step.width,step.height,{kernel:'lanczos3',fit:'fill'});if(step.forceRgb)image=image.removeAlpha();
   await publish(step.path,await image.png({compressionLevel:9,adaptiveFiltering:true}).toBuffer());
  }
  }catch(error){failures.push({step,error});}
 }
 if(failures.length===1)throw failures[0].error;
 if(failures.length)throw new AggregateError(failures.map(f=>f.error),`${failures.length} acquisition steps failed (every step was attempted):\n`+failures.map(f=>` - ${'path' in f.step?f.step.path:f.step.kind}: ${f.error instanceof Error?f.error.message:String(f.error)}`).join('\n'));
 return {operationCount:selected.length};
}
