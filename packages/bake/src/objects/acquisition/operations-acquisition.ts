import { parseAcquisitionPlan as parseSharedAcquisitionPlan, type AcquisitionOperation, type AcquisitionPlan } from '@cssearth/objects';
import sharp from 'sharp';
import { lstat, readFile, mkdir, rename, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { containedPath, declaredDownloadBytes, publishPinnedSource, publishPinnedSourceStream, sourceCacheUrl, withIdleTimeout } from '../sources/index.ts';
import type { SourceManifest, SourceEntry } from '../sources/index.ts';
import { assertRangeResponse, rangeRequestHeader } from '@cssearth/objects/node';
import { prepareSatelliteCatalog, validateSatelliteCatalogRecipe } from './satellite-catalog.ts';
import { prepareDskMesh, validateDskMeshRecipe } from './dsk-mesh.ts';
import { missingCoverageColor } from '../../raster/index.ts';
export interface AcquisitionTransport { fetch(url:string,init?:RequestInit):Promise<Response>; }
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError('Expected acquisition object.');return value as Record<string,unknown>;};
export function parseAcquisitionPlan(value: unknown): AcquisitionPlan {
 return parseSharedAcquisitionPlan(value, { containedPath: path => containedPath('.', path), validateDskMeshRecipe });
}

// The mirror is opt-in (default null): a caller must name RUNTIME_ASSET_ORIGIN explicitly to use it. Defaulting to
// it here would make every caller — including a test that only wired up its own `transport` — silently also try a
// real request to the production mirror URL, which a narrowly-scoped mock's URL assertion then rejects.
/** A local archive cache file named after its URL, so the same deposit is downloaded once for every member read from it. */
const archiveCacheName=(url:string)=>url.replace(/^https?:\/\//,'').replace(/[^A-Za-z0-9._-]+/g,'_').slice(-200);
const rangeHeaders=(entry:SourceEntry,headers?:Record<string,string>)=>entry.range?{...headers,Range:rangeRequestHeader(entry.range)}:headers;
const rangedEntry=(manifest:SourceManifest,path:string)=>[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].some(entry=>entry.path===path&&entry.range!==undefined);
// An archive such as Zenodo answers 403 to a request that does not say who asks, the runtime's default user agent included. The
// default transport names this project; a step's own headers win.
const SOURCE_USER_AGENT='cssEarth/0.6 (https://github.com/layoutit/css.earth; source restore)';
const NAMED_TRANSPORT:AcquisitionTransport={fetch:(url,init)=>fetch(url,{...init,headers:{'user-agent':SOURCE_USER_AGENT,...Object.fromEntries(new Headers(init?.headers))}})};
/** A command's output as a stream. It is piped on at once: Node discards what a finished child wrote that nothing reads yet, so a reader
 *  that arrives late (publishPinnedSourceStream makes the directory first) got none of a small member, and an empty file was pinned.
 *  A command that fails ends the stream with the first line of its complaint, under `what`. */
export function commandOutput(command:string,args:readonly string[],what:string):Readable {
 const child=spawn(command,args,{stdio:['ignore','pipe','pipe']}),output=child.stdout.pipe(new PassThrough());
 let complaint='';child.stderr.on('data',(chunk:Buffer)=>{complaint+=chunk.toString();});
 const exit=new Promise<number|null>(done=>{child.on('close',done);});
 child.on('error',error=>{output.destroy(error);});
 return Readable.from((async function*(){
  for await(const chunk of output)yield chunk as Buffer;
  if(await exit!==0)throw new Error(`${what}: ${complaint.trim().split('\n')[0]||'no message'}.`);
 })());
}
export async function executeAcquisition({sourceRoot,manifest,plan,group='refresh',transport=NAMED_TRANSPORT,mirrorOrigin=null,objectId=basename(dirname(sourceRoot))}:{sourceRoot:string;manifest:SourceManifest;plan:AcquisitionPlan;group?:string;transport?:AcquisitionTransport;mirrorOrigin?:string|null;objectId?:string}) {
 const selected=plan.operations.filter(step=>step.groups.includes(group));if(!selected.length)throw new Error(`Acquisition group ${group} is undeclared.`);
 const request=async(url:string,init?:RequestInit)=>{const response=await transport.fetch(url,init);if(!response.ok)throw new Error(`Source request failed ${response.status}: ${url}.`);return response;};
 const bytes=async(url:string)=>new Uint8Array(await(await request(url)).arrayBuffer());
 const publish=async(path:string,data:Uint8Array)=>{const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===path);if(!entry)throw new Error(`Undeclared acquisition target: ${path}.`);return publishPinnedSource({sourceRoot,entry,bytes:data});};
 // Attempt every step so one unreachable host does not hide the others; report all failures together.
 const hriiResults=new Map<string,Awaited<ReturnType<typeof import('../layers/terrestrial/index.ts').prepareHriiFacets>>>();
 const spectralResults=new Map<string,Awaited<ReturnType<typeof import('../layers/observation/index.ts').prepareSpectralBandMaps>>>();
 const compositionResults=new Map<string,Awaited<ReturnType<typeof import('./mapped-composition.ts').prepareMappedComposition>>>();
 const failures:{step:(typeof selected)[number];error:unknown}[]=[];
 for(const step of selected){
  try{
  if(step.kind==='download'){
   if(!step.encoding){
    const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===step.path);if(!entry)throw new Error(`Undeclared acquisition target: ${step.path}.`);
    // Try our own mirror (keyed by object id and manifest path) first, through the same injected transport as the publisher (so tests
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
   const archivePath=resolve(cache,`${archiveCacheName(step.url)}.zip`);
   if(!await lstat(archivePath).then(info=>info.isFile()&&info.size>0,()=>false)){
    const response=await request(step.url);if(!response.body)throw new Error('ZIP download has no body.');
    const temporary=`${archivePath}.partial-${process.pid}`;
    try{await pipeline(Readable.fromWeb(response.body as never),createWriteStream(temporary));await rename(temporary,archivePath);}finally{await rm(temporary,{force:true});}
   }
   const entry=[...manifest.inputs,...manifest.generatedIntermediates,...manifest.documents].find(entry=>entry.path===step.path);if(!entry)throw new Error(`Undeclared acquisition target: ${step.path}.`);
   // unzip writes the member straight into the pinned file, so one of hundreds of megabytes is never held in memory. A
   // member unzip could not read whole fails the stream before the file takes its place.
   await publishPinnedSourceStream({sourceRoot,entry,stream:commandOutput('unzip',['-p',archivePath,step.member],`unzip could not read ${step.member} from ${step.url}`)});
  }
  else if(step.kind==='tar-gz-member'){
   const cache=resolve('.local/source-archives');await mkdir(cache,{recursive:true});
   // As for ZIP members: the archive is cached by its URL and tar streams the one member out of it.
   const archivePath=resolve(cache,`${archiveCacheName(step.url)}.tar.gz`);
   if(!await lstat(archivePath).then(info=>info.isFile()&&info.size>0,()=>false)){
    const response=await request(step.url);if(!response.body)throw new Error('tar.gz download has no body.');
    const temporary=`${archivePath}.partial-${process.pid}`;
    try{await pipeline(Readable.fromWeb(response.body as never),createWriteStream(temporary));await rename(temporary,archivePath);}finally{await rm(temporary,{force:true});}
   }
   const {stdout}=await promisify(execFile)('tar',['-xzOf',archivePath,step.member],{encoding:'buffer',maxBuffer:512*1024*1024});
   await publish(step.path,stdout);
  }
  else if(step.kind==='hrii-facets'){
   let result=hriiResults.get(step.recipePath);
   if(!result){const {prepareHriiFacets}=await import('../layers/terrestrial/index.ts');result=await prepareHriiFacets(sourceRoot,step.recipePath);hriiResults.set(step.recipePath,result);}
   await publish(step.path,step.product==='fields'?result.bytes:new TextEncoder().encode(JSON.stringify(result.report,null,2)+'\n'));
  }
  else if(step.kind==='spectral-band-maps'){
   let result=spectralResults.get(step.recipePath);
   if(!result){const {prepareSpectralBandMaps}=await import('../layers/observation/index.ts');result=await prepareSpectralBandMaps(sourceRoot,step.recipePath);spectralResults.set(step.recipePath,result);}
   const bytes=step.product==='report'?new TextEncoder().encode(JSON.stringify(result.report,null,2)+'\n'):result.products[step.product];
   if(!bytes)throw new Error(`Unknown spectral band map ${step.product}.`);
   await publish(step.path,bytes);
  }
  else if(step.kind==='geotiff-grid'||step.kind==='geotiff-image'){
   const {readGeoTiffGridRecipe,prepareGeoTiffGrid}=await import('./geotiff-grid.ts');
   const {readGeoTiffImageRecipe,prepareGeoTiffImage}=await import('./geotiff-image.ts');
   const recipe=step.kind==='geotiff-image'?await readGeoTiffImageRecipe(sourceRoot,step.recipePath):await readGeoTiffGridRecipe(sourceRoot,step.recipePath);
   if(mirrorOrigin){
    const entry=manifest.inputs.find(entry=>entry.path===step.path);
    if(!entry)throw new Error(`Undeclared GeoTIFF grid target: ${step.path}.`);
    try{
     const response=await transport.fetch(sourceCacheUrl(mirrorOrigin,objectId,step.path));
     if(response.ok&&response.body){
      await publishPinnedSourceStream({sourceRoot,entry,stream:withIdleTimeout(Readable.fromWeb(response.body as never),8000),
       declaredBytes:declaredDownloadBytes(entry,response)});
      continue;
     }
     await response.body?.cancel();
    }catch{/* Recreate the compact grid from its native publisher product on a cache miss. */}
   }
   const options:{transport:typeof fetch}={transport:(url,init)=>transport.fetch(String(url),init)};
   const result=recipe.schema==='cssearth-geotiff-image@1'?await prepareGeoTiffImage(recipe,options):await prepareGeoTiffGrid(recipe,options);
   await publish(step.path,result.bytes);
  }
  else if(step.kind==='mapped-composition'){
   let result=compositionResults.get(step.recipePath);
   if(!result){const {prepareMappedComposition}=await import('./mapped-composition.ts');result=await prepareMappedComposition(sourceRoot,step.recipePath);compositionResults.set(step.recipePath,result);}
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
   const {timeListRows,horizonsRows}=await import('../layers/terrestrial/index.ts');
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
   if(step.missingCoverage==='transparent'){await publish(step.path,await transparentGapsAsCoverage(step,inputs));continue;}
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

/**
 * A gray tile service that marks no-data as transparency and averages observed values with those transparent zeros
 * when it downsamples (Trek's partial-alpha pixels, gray ≈ observed mean × alpha / 255). Dividing by alpha recovers the
 * observed mean, with an 8-bit rounding error of at most ±1 DN when alpha ≥ 128. Pixels less than half observed become
 * the shared missing-coverage grid rather than being recovered from too few samples.
 */
async function transparentGapsAsCoverage(step:Extract<AcquisitionOperation, { kind: 'tile-mosaic' }>,inputs:{input:Buffer;left:number;top:number}[]) {
 const {width,height}=step,gray=new Uint8Array(width*height),alpha=new Uint8Array(width*height);
 // Tiles are decoded one by one; compositing would premultiply partial alpha and shift gray values by up to 2 DN.
 for(const tile of inputs){
  const {data,info}=await sharp(tile.input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==step.tileSize||info.height!==step.tileSize||info.channels!==4)throw new Error(`${step.path}: tile at ${tile.left},${tile.top} is ${info.width}x${info.height} with ${info.channels} channels.`);
  for(let y=0;y<info.height&&tile.top+y<height;y++)for(let x=0;x<info.width&&tile.left+x<width;x++){
   const source=(y*info.width+x)*4,target=(tile.top+y)*width+tile.left+x;
   if(data[source]!==data[source+1]||data[source]!==data[source+2])throw new Error(`${step.path}: tile at ${tile.left},${tile.top} is not gray at ${x},${y}.`);
   gray[target]=data[source]!;alpha[target]=data[source+3]!;
  }
 }
 const rgb=new Uint8Array(width*height*3);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,a=alpha[i]!;
  if(a<128)rgb.set(missingCoverageColor(-180+(x+.5)*360/width,90-(y+.5)*180/height,180/height),i*3);
  else rgb.fill(Math.min(255,Math.round(gray[i]!*255/a)),i*3,i*3+3);
 }
 return sharp(rgb,{raw:{width,height,channels:3}}).png({compressionLevel:9,adaptiveFiltering:true}).toBuffer();
}

/** Default acquisition restores missing pins only. Existing bytes are verified afterwards, so a stale pin never blocks a download. */
export async function restoreMissingSources({sourceRoot,manifest,plan,missing,transport,mirrorOrigin}:{sourceRoot:string;manifest:SourceManifest;plan:AcquisitionPlan;missing:string[];transport?:AcquisitionTransport;mirrorOrigin?:string|null}) {
 const wanted=new Set(missing);
 const operations=plan.operations.filter(step=>'path' in step&&wanted.has(step.path));
 const covered=new Set(operations.map(step=>'path' in step?step.path:''));
 if([...wanted].some(path=>!covered.has(path)))throw new Error(`No authored acquisition restores: ${[...wanted].filter(path=>!covered.has(path)).join(', ')}.`);
 if(!operations.length)return {operationCount:0};
 return executeAcquisition({sourceRoot,manifest,plan:{...plan,operations:operations.map(step=>({...step,groups:['restore-missing']}))},group:'restore-missing',transport,mirrorOrigin});
}
