import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { containedPath, publishPinnedSource } from './operations.js';
import type { SourceManifest } from './operations.js';
interface OperationBase { groups:string[]; }
interface Download extends OperationBase {kind:'download';path:string;url:string;}
interface VerifyDownload extends OperationBase {kind:'verify-download';url:string;sha256:string;}
interface Mosaic extends OperationBase {kind:'tile-mosaic';path:string;url:string;tileSize:number;columns:number;rows:number;dataWidth:number;dataHeight:number;width:number;height:number;forceRgb:boolean;concurrency:number;}
interface RequestCheck extends OperationBase {kind:'verify-request';url:string;form:Record<string,string>;fileSource?:string;expectedPath:string;selector:'trim'|'numeric-lines'|'before-marker';marker?:string;rowCount?:number;}
interface JsonCheck extends OperationBase {kind:'verify-json';url:string;expectedPath:string;fields:Record<string,string>;}
interface Catalog extends OperationBase {kind:'catalog-field';path:string;url:string;sha256:string;catalogRows:number;selectedCount:number;template:{schema:string;source:Record<string,unknown>;projection:Record<string,unknown>;presentation:Record<string,unknown>;starColumns:string[]};}
export type AcquisitionOperation=Download|VerifyDownload|Mosaic|RequestCheck|JsonCheck|Catalog;
export interface AcquisitionPlan {schema:'cssearth-acquisition-plan@1';operations:AcquisitionOperation[];}
export interface AcquisitionTransport { fetch(url:string,init?:RequestInit):Promise<Response>; }
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected acquisition object.');return value as Record<string,unknown>;};
export function parseAcquisitionPlan(value:unknown):AcquisitionPlan {
 const plan=record(value);if(plan.schema!=='cssearth-acquisition-plan@1'||!Array.isArray(plan.operations)||!plan.operations.length)throw new TypeError('Invalid acquisition plan.');
 for(const value of plan.operations){const step=record(value);if(typeof step.url!=='string'||!/^https?:\/\//.test(step.url)||!Array.isArray(step.groups)||!step.groups.length||step.groups.some(group=>typeof group!=='string'))throw new TypeError('Acquisition URL or groups are missing.');
  if(!['download','verify-download','tile-mosaic','verify-request','verify-json','catalog-field'].includes(String(step.kind)))throw new TypeError('Unknown acquisition operator.');
  for(const key of ['path','expectedPath','fileSource'])if(step[key]!==undefined){if(typeof step[key]!=='string')throw new TypeError('Invalid acquisition path.');containedPath('.',step[key]);}
  if(step.kind==='download'||step.kind==='tile-mosaic'||step.kind==='catalog-field')if(typeof step.path!=='string')throw new TypeError('Acquisition destination is missing.');
  if(step.kind==='verify-download'||step.kind==='catalog-field')if(typeof step.sha256!=='string'||!/^[a-f0-9]{64}$/.test(step.sha256))throw new TypeError('Acquisition integrity hash is missing.');
  if(step.kind==='tile-mosaic')for(const key of ['tileSize','columns','rows','dataWidth','dataHeight','width','height','concurrency'])if(typeof step[key]!=='number'||!Number.isSafeInteger(step[key])||step[key]<=0)throw new TypeError(`Invalid mosaic ${key}.`);
  if(step.kind==='verify-request'){record(step.form);if(typeof step.expectedPath!=='string'||!['trim','numeric-lines','before-marker'].includes(String(step.selector)))throw new TypeError('Invalid source response comparator.');if(step.selector==='before-marker'&&typeof step.marker!=='string')throw new TypeError('Source marker is missing.');}
  if(step.kind==='verify-json')record(step.fields);
  if(step.kind==='catalog-field'){const template=record(step.template);for(const key of ['source','projection','presentation'])record(template[key]);if(typeof step.catalogRows!=='number'||typeof step.selectedCount!=='number'||step.selectedCount<=0||!Array.isArray(template.starColumns))throw new TypeError('Invalid catalogue acquisition template.');}
 }
 return plan as unknown as AcquisitionPlan;
}
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function csvRow(row:string):string[]{const fields:string[]=[];let field='',quoted=false;for(let index=0;index<row.length;index++){const c=row[index];if(c==='"'){if(quoted&&row[index+1]==='"'){field+='"';index++;}else quoted=!quoted;}else if(c===','&&!quoted){fields.push(field);field='';}else field+=c;}fields.push(field);return fields;}
function prepareCatalog(step:Catalog,bytes:Uint8Array):Uint8Array {
 if(digest(bytes)!==step.sha256)throw new Error('Pinned catalogue source drifted.');
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
 const publish=async(path:string,data:Uint8Array)=>{const entry=[...manifest.inputs,...manifest.documents].find(entry=>entry.path===path);if(!entry)throw new Error(`Undeclared acquisition target: ${path}.`);return publishPinnedSource({sourceRoot,entry,bytes:data});};
 for(const step of selected){
  if(step.kind==='download')await publish(step.path,await bytes(step.url));
  else if(step.kind==='verify-download'){if(digest(await bytes(step.url))!==step.sha256)throw new Error(`Pinned upstream bytes drifted: ${step.url}.`);}
  else if(step.kind==='catalog-field')await publish(step.path,prepareCatalog(step,await bytes(step.url)));
  else if(step.kind==='verify-json'){const expected=record(JSON.parse(await readFile(containedPath(sourceRoot,step.expectedPath),'utf8')) as unknown),actual=record(await(await request(step.url)).json());for(const [remote,local] of Object.entries(step.fields))if(actual[remote]!==expected[local])throw new Error(`Source identity field ${remote} drifted.`);}
  else if(step.kind==='verify-request'){
   const form={...step.form};if(step.fileSource)form.file=await readFile(containedPath(sourceRoot,step.fileSource),'utf8');
   let actual=await(await request(step.url,{method:'POST',body:new URLSearchParams(form)})).text(),expected=await readFile(containedPath(sourceRoot,step.expectedPath),'utf8');
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
 }
 return {operationCount:selected.length};
}
