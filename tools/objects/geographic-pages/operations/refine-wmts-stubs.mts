import { sha256 } from '../../../../src/platform/sha256.mts';
import { parseGeographicScene, parseGlobalInputs, parseRegionReceipt, parseTileStub, shape, array, text, number, optional } from '../source-records.mts';
import { Worker,isMainThread,parentPort,workerData } from "node:worker_threads";
import { readFile,writeFile,rename } from "node:fs/promises";
import { dirname,join } from "node:path";
import { gzipSync,gunzipSync } from "node:zlib";

import { prepareWmtsTile } from "../wmts-page-geometry.mts";
import {} from "../prepare-wmts-tree.mts";
import {commandContext} from './context.mts';

import type { OperationContext } from './context.mts';
import type { GeographicScene, TileAddress } from '../contracts.mts';
function coverageParts({zoom,x,y}: TileAddress,scene: GeographicScene){
  const groups=new Map<string,{normal:number[];lo:number[];hi:number[]}>();
  for(const page of prepareWmtsTile({zoom,x,y},scene)){
    let group=groups.get(page.coarseKey);
    if(!group){group={normal:page.normal,lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};groups.set(page.coarseKey,group);}
    for(const point of page.corners)for(let i=0;i<3;i++){group.lo[i]=Math.min(group.lo[i],point[i]);group.hi[i]=Math.max(group.hi[i],point[i]);}
  }
  return [...groups.values()].map(({normal,lo,hi})=>({normal,corners:Array.from({length:8},(_,i)=>[0,1,2].map(a=>(i>>a&1?hi:lo)[a]))}));
}
async function refineRegion(directory: string,address: TileAddress,version: string,toolHash: string,scene: GeographicScene){
  const name=`8-${address.x}-${address.y}`,recordPath=join(directory,name+".json"),saved=parseRegionReceipt(JSON.parse(await readFile(recordPath,"utf8")));
  if(saved.stubRefinement===toolHash&&saved.version===version)return;
  const path=join(directory,name+".pack"),old=await readFile(path),ref=saved.root.directory;
  if(sha256(old)!==saved.sha256)throw new Error(`Prepared pack changed: ${name}`);
  const raw=gunzipSync(old.subarray(ref.offset,ref.offset+ref.bytes)),length=raw.readUInt32LE(8),header=shape({envelope:shape({external:array(parseTileStub)})})(JSON.parse(raw.subarray(16,16+length).toString("utf8")));
  for(const stub of header.envelope.external){
    const [zoom,x,y]=stub.key.slice("wmts-tile-".length).split("-").map(Number);
    stub.coverageParts=coverageParts({zoom,x,y},scene);stub.directory.url=stub.directory.url.replace(/wmts-[a-f0-9]{16}/,`wmts-${version}`);
  }
  const json=Buffer.from(JSON.stringify(header)),decoded=Buffer.concat([raw.subarray(0,16),json,raw.subarray(16+length)]);decoded.writeUInt32LE(json.length,8);
  const compressed=gzipSync(decoded,{level:6}),bytes=Buffer.concat([old.subarray(0,ref.offset),compressed]);
  saved.root.coverageParts=coverageParts(address,scene);
  saved.root.directory={...ref,url:ref.url.replace(/wmts-[a-f0-9]{16}/,`wmts-${version}`),bytes:compressed.length,sha256:sha256(compressed),decodedBytes:decoded.length,decodedSha256:sha256(decoded)};
  saved.version=version;saved.bytes=bytes.length;saved.sha256=sha256(bytes);saved.stubRefinement=toolHash;
  await writeFile(path+".part",bytes);await rename(path+".part",path);await writeFile(recordPath+".part",JSON.stringify(saved));await rename(recordPath+".part",recordPath);
}

export async function refineWmtsStubs(inputDirectory: string,{context,workers=4}: {context?:OperationContext;workers?:number}={}){
  if(!context)throw new TypeError('Stub refinement requires its selected object context.');
  const scene=await context.readPrepared('scene',parseGeographicScene);
  const inputs=parseGlobalInputs(JSON.parse(await readFile(join(inputDirectory,"inputs.json"),"utf8"))),toolHash=sha256(await readFile(new URL(import.meta.url)));
  inputs.hashes["tools/objects/geographic-pages/operations/refine-wmts-stubs.mts"]=toolHash;
  const version=sha256(JSON.stringify({schema:1,lastLevel:inputs.lastLevel,source:inputs.sourceSha256,hashes:inputs.hashes})).slice(0,16);
  const directory=join(dirname(inputDirectory.replace(/\/$/,"")),version);
  if(directory!==inputDirectory.replace(/\/$/,""))await rename(inputDirectory,directory);
  inputs.version=version;await writeFile(join(directory,"inputs.json"),JSON.stringify(inputs,null,2));
  const addresses: TileAddress[]=[];for(const band of inputs.levels.find(l=>l.zoom===8)!.bands)for(let y=band.y0;y<band.y1;y++)for(const [a,b] of band.ranges)for(let x=a;x<b;x++)addresses.push({zoom:8,x,y});
  let cursor=0,completed=0;let failure: string | undefined;const start=Date.now();console.log(JSON.stringify({phase:"prepared-face-bounds",directory,regions:addresses.length}));
  await Promise.all(Array.from({length:workers},()=>new Promise<void>((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{scene,directory,version,toolHash}});
    const next=()=>{if(failure||cursor===addresses.length){worker.terminate().then(()=>resolve(),reject);return;}worker.postMessage(addresses[cursor++]);};
    worker.on("message",(value: unknown)=>{const result=shape({error:optional(text)})(value);if(result.error){failure??=result.error;console.error(result.error);}else completed++;
      if(completed%1000===0)console.log(JSON.stringify({completed,total:addresses.length,elapsedSeconds:(Date.now()-start)/1000}));next();});
    worker.on("error",reject);next();
  })));
  if(failure)throw new Error(failure);return directory;
}
if(!isMainThread){if(!parentPort)throw new Error('Refinement worker requires a parent port');const port=parentPort;const data=shape({directory:text,version:text,toolHash:text,scene:parseGeographicScene})(workerData);port.on('message',async(value:unknown)=>{try{const address=shape({zoom:number,x:number,y:number})(value);await refineRegion(data.directory,address,data.version,data.toolHash,data.scene);port.postMessage({ok:true});}catch(error){port.postMessage({error:error instanceof Error ? error.stack : String(error)});}});}
else if(process.argv[1]===new URL(import.meta.url).pathname){const context=commandContext();console.log(JSON.stringify({directory:await refineWmtsStubs(context.args[0],{context})}));}
