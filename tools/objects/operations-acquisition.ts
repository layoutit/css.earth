import sharp from 'sharp';
import { readFile, mkdir, rename, rm } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import {gzipSync} from 'node:zlib';
import { containedPath, publishPinnedSource, publishPinnedSourceStream } from './operations.js';
import type { SourceManifest } from './operations.js';
import {prepareSatelliteCatalog,validateSatelliteCatalogRecipe} from './acquisition/satellite-catalog.mts';
import {prepareProjectedCatalog} from './acquisition/projected-catalog.mts';
import {prepareDskMesh,validateDskMeshRecipe} from './acquisition/dsk-mesh.mts';
import {csvRow} from './acquisition/csv.mts';
interface HriiFacets extends OperationBase {kind:'hrii-facets';path:string;recipePath:string;product:'fields'|'report';}
interface DskMesh extends OperationBase {kind:'dsk-mesh';path:string;recipe:Record<string,unknown>;}
interface OperationBase { groups:string[]; }
interface Download extends OperationBase {kind:'download';path:string;url:string;headers?:Record<string,string>;encoding?:'gzip'|'pretty-json';expectedJsonFields?:Record<string,unknown>;}
interface RequestDownload extends OperationBase {kind:'request-download';path:string;url:string;form:Record<string,string>;fileSource?:string;trimEnd?:boolean;appendText?:string;headers?:Record<string,string>;replacements?:{pattern:string;flags?:string;replacement:string}[];requiredPrefix?:string;requiredText?:string[];numericLineCount?:number;}
interface JsonDocument extends OperationBase {kind:'json-document';path:string;value:Record<string,unknown>;}
interface ZipMember extends OperationBase {kind:'zip-member';path:string;url:string;archiveSha256:string;archiveBytes:number;member:string;}
interface SatelliteCatalog extends OperationBase {kind:'satellite-catalog';path:string;recipePath:string;headers?:Record<string,string>;}
interface VerifyDownload extends OperationBase {kind:'verify-download';url:string;sha256:string;}
interface Mosaic extends OperationBase {kind:'tile-mosaic';path:string;url:string;tileSize:number;columns:number;rows:number;dataWidth:number;dataHeight:number;width:number;height:number;forceRgb:boolean;concurrency:number;}
interface RequestCheck extends OperationBase {kind:'verify-request';url:string;form:Record<string,string>;fileSource?:string;expectedPath:string;selector:'trim'|'numeric-lines'|'before-marker';marker?:string;rowCount?:number;headers?:Record<string,string>;}
interface JsonCheck extends OperationBase {kind:'verify-json';url:string;expectedPath:string;fields:Record<string,string>;}
interface Catalog extends OperationBase {kind:'catalog-field';path:string;url:string;sha256:string;catalogRows:number;selectedCount:number;selection?:{model:'gnomonic';centerRaDegrees:number;centerDecDegrees:number;horizontalFovDegrees:number;aspectRatio:number};template:{schema:string;source:Record<string,unknown>;projection:Record<string,unknown>;presentation:Record<string,unknown>;starColumns?:string[]};}
export type AcquisitionOperation=HriiFacets|DskMesh|Download|RequestDownload|JsonDocument|ZipMember|SatelliteCatalog|VerifyDownload|Mosaic|RequestCheck|JsonCheck|Catalog;
export interface AcquisitionPlan {schema:'cssearth-acquisition-plan@1';operations:AcquisitionOperation[];}
export interface AcquisitionTransport { fetch(url:string,init?:RequestInit):Promise<Response>; }
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected acquisition object.');return value as Record<string,unknown>;};
export function parseAcquisitionPlan(value:unknown):AcquisitionPlan {
 const plan=record(value);if(plan.schema!=='cssearth-acquisition-plan@1'||!Array.isArray(plan.operations)||!plan.operations.length)throw new TypeError('Invalid acquisition plan.');
 for(const value of plan.operations){const step=record(value);if(!['json-document','dsk-mesh','hrii-facets','satellite-catalog','zip-member'].includes(String(step.kind))&&(typeof step.url!=='string'||!/^https?:\/\//.test(step.url))||!Array.isArray(step.groups)||!step.groups.length||step.groups.some(group=>typeof group!=='string'))throw new TypeError('Acquisition URL or groups are missing.');
  if(!['download','request-download','json-document','dsk-mesh','hrii-facets','zip-member','satellite-catalog','verify-download','tile-mosaic','verify-request','verify-json','catalog-field'].includes(String(step.kind)))throw new TypeError('Unknown acquisition operator.');
  for(const key of ['path','expectedPath','fileSource','recipePath','member'])if(step[key]!==undefined){if(typeof step[key]!=='string')throw new TypeError('Invalid acquisition path.');containedPath('.',step[key]);}
  if(['download','request-download','json-document','dsk-mesh','hrii-facets','zip-member','satellite-catalog','tile-mosaic','catalog-field'].includes(String(step.kind)))if(typeof step.path!=='string')throw new TypeError('Acquisition destination is missing.');
  if(step.kind==='zip-member'&&(typeof step.url!=='string'||!/^https:\/\//.test(step.url)||typeof step.archiveSha256!=='string'||!/^[a-f0-9]{64}$/.test(step.archiveSha256)||!Number.isSafeInteger(step.archiveBytes)||Number(step.archiveBytes)<=0||typeof step.member!=='string'||!/^[A-Za-z0-9_./-]+$/.test(step.member)||step.member.startsWith('-')))throw new TypeError('Invalid ZIP member.');
  if(step.headers!==undefined){const headers=record(step.headers);if(Object.values(headers).some(value=>typeof value!=='string'))throw new TypeError('Acquisition headers must be text.');}
  if(step.kind==='request-download'||step.kind==='verify-request'){const form=record(step.form);if(Object.values(form).some(value=>typeof value!=='string'))throw new TypeError('Acquisition form values must be text.');}
  if(step.kind==='request-download'&&(step.trimEnd!==undefined&&typeof step.trimEnd!=='boolean'||step.appendText!==undefined&&typeof step.appendText!=='string'))throw new TypeError('Invalid response text transformation.');
  if(step.kind==='download'&&step.encoding!==undefined&&!['gzip','pretty-json'].includes(String(step.encoding)))throw new TypeError('Unknown source download encoding.');
  if(step.kind==='download'&&step.expectedJsonFields!==undefined)record(step.expectedJsonFields);
  if(step.kind==='request-download'&&(step.requiredPrefix!==undefined&&typeof step.requiredPrefix!=='string'||step.requiredText!==undefined&&(!Array.isArray(step.requiredText)||step.requiredText.some(value=>typeof value!=='string'))||step.numericLineCount!==undefined&&(!Number.isSafeInteger(step.numericLineCount)||Number(step.numericLineCount)<1)))throw new TypeError('Invalid source response checks.');
  if(step.kind==='request-download'&&step.replacements!==undefined){if(!Array.isArray(step.replacements))throw new TypeError('Response replacements must be an array.');for(const value of step.replacements){const replacement=record(value);if(typeof replacement.pattern!=='string'||typeof replacement.replacement!=='string'||replacement.flags!==undefined&&(typeof replacement.flags!=='string'||!/^[gimu]*$/.test(replacement.flags)))throw new TypeError('Invalid response text replacement.');new RegExp(replacement.pattern,replacement.flags as string|undefined);}}
  if(step.kind==='json-document')record(step.value);
  if(step.kind==='hrii-facets'&&(typeof step.recipePath!=='string'||!['fields','report'].includes(String(step.product))))throw new TypeError('Invalid HRII facet acquisition.');
  if(step.kind==='dsk-mesh')validateDskMeshRecipe(step.recipe);
  if(step.kind==='satellite-catalog'&&typeof step.recipePath!=='string')throw new TypeError('Satellite catalog recipe is missing.');
  if(step.kind==='verify-download'||step.kind==='catalog-field')if(typeof step.sha256!=='string'||!/^[a-f0-9]{64}$/.test(step.sha256))throw new TypeError('Acquisition integrity hash is missing.');
  if(step.kind==='tile-mosaic')for(const key of ['tileSize','columns','rows','dataWidth','dataHeight','width','height','concurrency'])if(typeof step[key]!=='number'||!Number.isSafeInteger(step[key])||step[key]<=0)throw new TypeError(`Invalid mosaic ${key}.`);
  if(step.kind==='verify-request'){record(step.form);if(typeof step.expectedPath!=='string'||!['trim','numeric-lines','before-marker'].includes(String(step.selector)))throw new TypeError('Invalid source response comparator.');if(step.selector==='before-marker'&&typeof step.marker!=='string')throw new TypeError('Source marker is missing.');}
  if(step.kind==='verify-json')record(step.fields);
  if(step.kind==='catalog-field'){const template=record(step.template);for(const key of ['source','projection','presentation'])record(template[key]);if(typeof step.catalogRows!=='number'||typeof step.selectedCount!=='number'||step.selectedCount<=0||step.selection===undefined&&!Array.isArray(template.starColumns))throw new TypeError('Invalid catalogue acquisition template.');if(step.selection!==undefined){const selection=record(step.selection);if(selection.model!=='gnomonic'||['centerRaDegrees','centerDecDegrees','horizontalFovDegrees','aspectRatio'].some(key=>typeof selection[key]!=='number'||!Number.isFinite(selection[key])))throw new TypeError('Invalid projected catalogue selection.');}}
 }
 return plan as unknown as AcquisitionPlan;
}
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function prepareCatalog(step:Catalog,bytes:Uint8Array):Uint8Array {
 if(digest(bytes)!==step.sha256)throw new Error('Pinned catalogue source drifted.');
 if(step.selection)return prepareProjectedCatalog({bytes,template:step.template,selection:step.selection,selectedCount:step.selectedCount,catalogRows:step.catalogRows});
 const rows=new TextDecoder().decode(bytes).trimEnd().split('\n');if(rows.length-1!==step.catalogRows)throw new Error('Pinned catalogue row count drifted.');
 const stars:number[][]=[];
 for(const row of rows.slice(1)){const fields=csvRow(row);if(fields[0]==='0')continue;const ra=Number(fields[7]),dec=Number(fields[8]),magnitude=Number(fields[13]),color=Number(fields[16]);if(![ra,dec,magnitude].every(Number.isFinite))continue;stars.push([Number(fields[0]),Number((ra*15).toFixed(7)),Number(dec.toFixed(7)),Number(magnitude.toFixed(3)),Number.isFinite(color)?Number(color.toFixed(3)):0.65]);}
 stars.sort((a,b)=>a[3]-b[3]||a[0]-b[0]);const selected=stars.slice(0,step.selectedCount);if(selected.length!==step.selectedCount)throw new Error('Catalogue population is too small.');
 return new TextEncoder().encode(JSON.stringify({...step.template,presentation:{...step.template.presentation,candidateStars:stars.length,selectedStars:selected.length,brightestMagnitude:selected[0][3],faintestMagnitude:selected[selected.length-1][3]},stars:selected},null,2)+'\n');
}
export async function executeAcquisition({sourceRoot,manifest,plan,group='refresh',transport={fetch}}:{sourceRoot:string;manifest:SourceManifest;plan:AcquisitionPlan;group?:string;transport?:AcquisitionTransport}) {
 const selected=plan.operations.filter(step=>step.groups.includes(group));if(!selected.length)throw new Error(`Acquisition group ${group} is undeclared.`);
 const request=async(url:string,init?:RequestInit)=>{const response=await transport.fetch(url,init);if(!response.ok)throw new Error(`Source request failed ${response.status}: ${url}.`);return response;};
 const bytes=async(url:string)=>new Uint8Array(await(await request(url)).arrayBuffer());
 const publish=async(path:string,data:Uint8Array)=>{const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===path);if(!entry)throw new Error(`Undeclared acquisition target: ${path}.`);return publishPinnedSource({sourceRoot,entry,bytes:data});};
 // Attempt every step so one unreachable host does not hide the others; report all failures together.
 const hriiResults=new Map<string,Awaited<ReturnType<typeof import('./terrestrial-layers/hrii-facets.mts').prepareHriiFacets>>>();
 const failures:{step:(typeof selected)[number];error:unknown}[]=[];
 for(const step of selected){
  try{
  if(step.kind==='download'){
   if(!step.encoding){
    const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===step.path);if(!entry)throw new Error(`Undeclared acquisition target: ${step.path}.`);
    const response=await request(step.url,{headers:step.headers});if(!response.body)throw new Error(`Source download has no body: ${step.url}.`);
    await publishPinnedSourceStream({sourceRoot,entry,stream:Readable.fromWeb(response.body as never)});continue;
   }
   let data=new Uint8Array(await(await request(step.url,{headers:step.headers})).arrayBuffer());
   if(step.encoding==='gzip')data=gzipSync(data,{level:9});
   if(step.encoding==='pretty-json'){const value=JSON.parse(new TextDecoder().decode(data)) as unknown;for(const[key,expected]of Object.entries(step.expectedJsonFields??{})){let actual=value;for(const part of key.split('.'))actual=record(actual)[part];if(actual!==expected)throw new Error(`Source JSON identity ${key} drifted.`);}data=new TextEncoder().encode(JSON.stringify(value,null,2)+'\n');}
   await publish(step.path,data);
  }
  else if(step.kind==='zip-member'){
   const cache=resolve('.local/source-archives');await mkdir(cache,{recursive:true});
   const archivePath=resolve(cache,`${step.archiveSha256}.zip`);
   const verifyArchive=async(path:string)=>{const hash=createHash('sha256');let size=0;for await(const chunk of createReadStream(path)){hash.update(chunk);size+=chunk.length;}if(size!==step.archiveBytes||hash.digest('hex')!==step.archiveSha256)throw new Error('ZIP source pin differs.');};
   try{await verifyArchive(archivePath);}catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    const response=await request(step.url);if(!response.body)throw new Error('ZIP download has no body.');
    const temporary=`${archivePath}.partial-${process.pid}`;
    try{await pipeline(Readable.fromWeb(response.body as never),createWriteStream(temporary));await verifyArchive(temporary);await rename(temporary,archivePath);}finally{await rm(temporary,{force:true});}
   }
   const {stdout}=await promisify(execFile)('unzip',['-p',archivePath,step.member],{encoding:'buffer',maxBuffer:512*1024*1024});
   await publish(step.path,stdout);
  }
  else if(step.kind==='hrii-facets'){
   let result=hriiResults.get(step.recipePath);
   if(!result){const {prepareHriiFacets}=await import('./terrestrial-layers/hrii-facets.mts');result=await prepareHriiFacets(sourceRoot,step.recipePath);hriiResults.set(step.recipePath,result);}
   await publish(step.path,step.product==='fields'?result.bytes:new TextEncoder().encode(JSON.stringify(result.report,null,2)+'\n'));
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
  else if(step.kind==='verify-download'){if(digest(await bytes(step.url))!==step.sha256)throw new Error(`Pinned upstream bytes drifted: ${step.url}.`);}
  else if(step.kind==='catalog-field')await publish(step.path,prepareCatalog(step,await bytes(step.url)));
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
