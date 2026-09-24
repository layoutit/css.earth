import { parseSourceBinding, type SourceBinding } from '../../src/platform/source-catalog.mts';
import { assertRangeResponse, assertSourceRange, rangeRequestHeader, SOURCE_MANIFEST_SCHEMA, type SourceRange } from '../../src/platform/source-manifest.mts';
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm, writeFile, lstat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, posix, resolve, relative, win32 } from 'node:path';
const object=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected an object.');return value as Record<string,unknown>;};
const nonempty=(value:unknown):value is string=>typeof value==='string'&&value.length>0;

/** A pin identifies bytes git does not hold. A file authored in this repository carries none; git is its record. */
export interface SourceEntry { path:string;id?:string;origin?:string;consumers?:string[];range?:SourceRange;sourceBinding?:SourceBinding; }

/** A file a named tool makes; parseSourceManifest refuses one without its generator. */
export interface GeneratedSourceEntry extends SourceEntry { generator:string; }
export interface SourceManifest { schema:string;inputs:SourceEntry[];generatedIntermediates:GeneratedSourceEntry[];documents:SourceEntry[]; }

export function containedPath(root:string,path:string):string {
 if(!nonempty(path)||path.includes('\\')||path.includes('\0')||posix.isAbsolute(path)||win32.isAbsolute(path)||posix.normalize(path)!==path||path==='.'||path.startsWith('../'))throw new TypeError(`Unsafe relative path: ${path}.`);
 return resolve(root,path);
}

export function parseSourceManifest(value:unknown,id?:string):SourceManifest {
 const manifest=object(value);
 if(manifest.schema!==SOURCE_MANIFEST_SCHEMA)throw new TypeError('Unsupported source manifest schema.');
 const paths=new Set<string>(),ids=new Set<string>();
 for(const collection of ['inputs','generatedIntermediates','documents'] as const){
  const entries=manifest[collection];if(!Array.isArray(entries)||(collection==='inputs'&&!entries.length))throw new TypeError(`Source manifest ${collection} is missing or empty.`);
  for(const value of entries){const entry=object(value);if(typeof entry.path!=='string')throw new TypeError('Source path is missing.');containedPath('.',entry.path);
   if(paths.has(entry.path))throw new TypeError(`Duplicate source path ${entry.path}.`);paths.add(entry.path);
   if(entry.range!==undefined)assertSourceRange(entry as unknown as SourceEntry,`Source ${entry.path}`);
   if(collection==='inputs'||entry.sourceBinding!==undefined)parseSourceBinding(entry.sourceBinding);
   if(collection==='inputs'){
    for(const field of ['id','origin','credit','license','acquisition','redistribution'])if(!nonempty(entry[field]))throw new TypeError(`Source ${entry.path} lacks ${field}.`);
    const inputId=String(entry.id);if(ids.has(inputId))throw new TypeError(`Duplicate source id ${inputId}.`);ids.add(inputId);
    if(!Array.isArray(entry.consumers)||!entry.consumers.length||entry.consumers.some(item=>!nonempty(item))||new Set(entry.consumers).size!==entry.consumers.length)throw new TypeError(`Source ${entry.path} has invalid consumers.`);
    if(entry.licenseEvidence!==undefined&&(!Array.isArray(entry.licenseEvidence)||!entry.licenseEvidence.length||entry.licenseEvidence.some(item=>!nonempty(item))||new Set(entry.licenseEvidence).size!==entry.licenseEvidence.length))throw new TypeError(`Source ${entry.path} has invalid license evidence.`);
   }else if(collection==='generatedIntermediates'&&!nonempty(entry.generator))throw new TypeError(`Source ${entry.path} lacks its generator.`);
   else if(collection==='documents'&&entry.purpose!==undefined&&(typeof entry.purpose!=='string'||!entry.purpose.trim()))throw new TypeError(`Source ${entry.path} has an empty purpose.`);
  }
 }
 return manifest as unknown as SourceManifest;
}

export async function assertSourceFile(entry:SourceEntry,path:string):Promise<void> {
 const info=await lstat(path);if(!info.isFile())throw new Error(`Source is not a regular file: ${entry.path}.`);
}

async function walk(root:string):Promise<string[]>{const files:string[]=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=resolve(root,entry.name);if(entry.isDirectory())files.push(...await walk(path));else if(entry.isFile())files.push(path);else throw new Error(`Unsupported filesystem entry: ${path}.`);}return files;}

export async function verifySources({sourceRoot,manifest,consumer}:{sourceRoot:string;manifest:SourceManifest;consumer?:string}) {
 const collections=[manifest.inputs,manifest.generatedIntermediates,manifest.documents];
 const entries=consumer?manifest.inputs.filter(entry=>entry.consumers?.includes(consumer)):collections.flat();
 if(!entries.length)throw new Error(`No source inputs for ${consumer??'manifest'}.`);
 if(!consumer){const declared=new Set(entries.map(entry=>entry.path)),actual=new Set((await walk(sourceRoot)).map(path=>relative(sourceRoot,path).replaceAll('\\','/')).filter(path=>path!=='manifest.json'));
  const undeclared=[...actual].filter(path=>!declared.has(path)),missing=[...declared].filter(path=>!actual.has(path));
  if(undeclared.length||missing.length)throw new Error(`Source coverage failed. Undeclared: ${undeclared.join(', ')||'none'}. Missing: ${missing.join(', ')||'none'}.`);
 }
 for(const entry of entries)await assertSourceFile(entry,containedPath(sourceRoot,entry.path));
 return {inputCount:manifest.inputs.length,generatedIntermediateCount:manifest.generatedIntermediates.length,documentCount:manifest.documents.length,verifiedCount:entries.length};
}

export async function publishPinnedSource({sourceRoot,entry,bytes}:{sourceRoot:string;entry:SourceEntry;bytes:Uint8Array}) {
 const path=containedPath(sourceRoot,entry.path);await mkdir(dirname(path),{recursive:true});
 const temporary=`${path}.partial-${process.pid}-${randomUUID()}`;
 try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}
 return entry;
}

/** The byte count a raw download is held to: a ranged input's own slice, else the answer's declared length, else
 *  null when the answer declares none. */
export function declaredDownloadBytes(entry:SourceEntry,response:{headers:{get(name:string):string|null}}):number|null {
 if(entry.range)return entry.range.length;
 const declared=response.headers.get('content-length');
 return declared!==null&&/^\d+$/.test(declared.trim())&&Number(declared)>0&&Number.isSafeInteger(Number(declared))?Number(declared):null;
}

/** Stream a raw source into a sibling temporary file; only a complete download replaces the destination. A declared
 *  size is enforced while the bytes flow, so an endless or overlong answer is cut off at the limit instead of being
 *  written out in full and judged afterwards. */
export async function publishPinnedSourceStream({sourceRoot,entry,stream,declaredBytes=null}:{sourceRoot:string;entry:SourceEntry;stream:Readable;declaredBytes?:number|null}) {
 const path=containedPath(sourceRoot,entry.path),temporary=`${path}.partial-${process.pid}-${randomUUID()}`;
 let received=0;
 const ceiling=new Transform({highWaterMark:0,transform(chunk:Uint8Array,_encoding,callback){
  received+=chunk.length;
  if(declaredBytes!==null&&received>declaredBytes){callback(new Error(`Source ${entry.path} size drifted: the answer passed its declared ${declaredBytes} bytes.`));return;}
  callback(null,chunk);
 }});
 try{
  await mkdir(dirname(path),{recursive:true});
  await pipeline(stream,ceiling,createWriteStream(temporary,{flags:'wx'}));
  if(declaredBytes!==null&&received!==declaredBytes)throw new Error(`Source ${entry.path} size drifted: received ${received} bytes of the declared ${declaredBytes}.`);
  await rename(temporary,path);
 }finally{stream.destroy();await rm(temporary,{force:true});}
 return entry;
}

export async function acquirePinnedDownloads({sourceRoot,manifest,paths,fetchBytes}:{sourceRoot:string;manifest:SourceManifest;paths:readonly string[];fetchBytes?:(url:string)=>Promise<Uint8Array>}) {
 const entries=[...manifest.inputs,...manifest.documents];
 for(const path of paths){const entry=entries.find(entry=>entry.path===path);if(!entry||!entry.origin||!/^https?:\/\//.test(entry.origin))throw new TypeError(`No declared direct acquisition URL for ${path}.`);
  if(fetchBytes){if(entry.range)throw new TypeError(`A ranged source needs a ranged request: ${path}.`);await publishPinnedSource({sourceRoot,entry,bytes:await fetchBytes(entry.origin)});}
  else{
   const response=await fetch(entry.origin,entry.range?{headers:{Range:rangeRequestHeader(entry.range)}}:undefined);if(!response.ok)throw new Error(`Acquisition failed ${response.status}: ${entry.origin}.`);
   if(entry.range)assertRangeResponse(response,entry.range,entry.origin);
   if(!response.body)throw new Error(`Source download has no body: ${entry.origin}.`);
   await publishPinnedSourceStream({sourceRoot,entry,stream:Readable.fromWeb(response.body as never),
    declaredBytes:declaredDownloadBytes(entry,response)});
  }
 }
 return {acquiredCount:paths.length};
}
