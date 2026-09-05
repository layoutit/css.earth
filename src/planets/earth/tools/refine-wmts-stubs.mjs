import { Worker,isMainThread,parentPort,workerData } from "node:worker_threads";
import { readFile,writeFile,rename } from "node:fs/promises";
import { dirname,join } from "node:path";
import { gzipSync,gunzipSync } from "node:zlib";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { prepareWmtsTile } from "./city/wmts-page-geometry.mjs";
import { hashBytes } from "./city/prepare-wmts-tree.mjs";

function coverageParts({zoom,x,y}){
  const groups=new Map();
  for(const page of prepareWmtsTile({zoom,x,y},scene)){
    let group=groups.get(page.coarseKey);
    if(!group){group={normal:page.normal,lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]};groups.set(page.coarseKey,group);}
    for(const point of page.corners)for(let i=0;i<3;i++){group.lo[i]=Math.min(group.lo[i],point[i]);group.hi[i]=Math.max(group.hi[i],point[i]);}
  }
  return [...groups.values()].map(({normal,lo,hi})=>({normal,corners:Array.from({length:8},(_,i)=>[0,1,2].map(a=>(i>>a&1?hi:lo)[a]))}));
}
async function refineRegion(directory,address,version,toolHash){
  const name=`8-${address.x}-${address.y}`,recordPath=join(directory,name+".json"),saved=JSON.parse(await readFile(recordPath,"utf8"));
  if(saved.stubRefinement===toolHash&&saved.version===version)return;
  const path=join(directory,name+".pack"),old=await readFile(path),ref=saved.root.directory;
  if(hashBytes(old)!==saved.sha256)throw new Error(`Prepared pack changed: ${name}`);
  const raw=gunzipSync(old.subarray(ref.offset,ref.offset+ref.bytes)),length=raw.readUInt32LE(8),header=JSON.parse(raw.subarray(16,16+length));
  for(const stub of header.envelope.external){
    const [zoom,x,y]=stub.key.slice("wmts-tile-".length).split("-").map(Number);
    stub.coverageParts=coverageParts({zoom,x,y});stub.directory.url=stub.directory.url.replace(/wmts-[a-f0-9]{16}/,`wmts-${version}`);
  }
  const json=Buffer.from(JSON.stringify(header)),decoded=Buffer.concat([raw.subarray(0,16),json,raw.subarray(16+length)]);decoded.writeUInt32LE(json.length,8);
  const compressed=gzipSync(decoded,{level:6}),bytes=Buffer.concat([old.subarray(0,ref.offset),compressed]);
  saved.root.coverageParts=coverageParts(address);
  saved.root.directory={...ref,url:ref.url.replace(/wmts-[a-f0-9]{16}/,`wmts-${version}`),bytes:compressed.length,sha256:hashBytes(compressed),decodedBytes:decoded.length,decodedSha256:hashBytes(decoded)};
  saved.version=version;saved.bytes=bytes.length;saved.sha256=hashBytes(bytes);saved.stubRefinement=toolHash;
  await writeFile(path+".part",bytes);await rename(path+".part",path);await writeFile(recordPath+".part",JSON.stringify(saved));await rename(recordPath+".part",recordPath);
}

export async function refineWmtsStubs(inputDirectory,{workers=4}={}){
  const inputs=JSON.parse(await readFile(join(inputDirectory,"inputs.json"),"utf8")),toolHash=hashBytes(await readFile(new URL(import.meta.url)));
  inputs.hashes["tools/refine-wmts-stubs.mjs"]=toolHash;
  const version=hashBytes(JSON.stringify({schema:1,lastLevel:inputs.lastLevel,source:inputs.sourceSha256,hashes:inputs.hashes})).slice(0,16);
  const directory=join(dirname(inputDirectory.replace(/\/$/,"")),version);
  if(directory!==inputDirectory.replace(/\/$/,""))await rename(inputDirectory,directory);
  inputs.version=version;await writeFile(join(directory,"inputs.json"),JSON.stringify(inputs,null,2));
  const addresses=[];for(const band of inputs.levels.find(l=>l.zoom===8).bands)for(let y=band.y0;y<band.y1;y++)for(const [a,b] of band.ranges)for(let x=a;x<b;x++)addresses.push({zoom:8,x,y});
  let cursor=0,completed=0,failure;const start=Date.now();console.log(JSON.stringify({phase:"prepared-face-bounds",directory,regions:addresses.length}));
  await Promise.all(Array.from({length:workers},()=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{directory,version,toolHash}});
    const next=()=>{if(failure||cursor===addresses.length){worker.terminate().then(resolve,reject);return;}worker.postMessage(addresses[cursor++]);};
    worker.on("message",result=>{if(result.error){failure??=result.error;console.error(result.error);}else completed++;
      if(completed%1000===0)console.log(JSON.stringify({completed,total:addresses.length,elapsedSeconds:(Date.now()-start)/1000}));next();});
    worker.on("error",reject);next();
  })));
  if(failure)throw new Error(failure);return directory;
}
if(!isMainThread){parentPort.on("message",async address=>{try{await refineRegion(workerData.directory,address,workerData.version,workerData.toolHash);parentPort.postMessage({ok:true});}catch(error){parentPort.postMessage({error:error.stack});}});}
else if(process.argv[1]===new URL(import.meta.url).pathname){console.log(JSON.stringify({directory:await refineWmtsStubs(process.argv[2])}));}
