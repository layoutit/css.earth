import { Worker } from "node:worker_threads";
import { mkdir, readFile, writeFile,rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { readWorldCoverCatalog } from "./city/worldcover-catalog.mjs";
import { prepareWmtsCoverage } from "./city/wmts-coverage.mjs";
import { coverageLookup,prepareTreeSection,hashBytes,tileKey } from "./city/prepare-wmts-tree.mjs";
const root=new URL("../../../../",import.meta.url),arg=(name,fallback)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split("=").slice(1).join("=")??fallback;
const lastLevel=Number(arg("last-level","14")),workers=Number(arg("workers","4")),limit=Number(arg("limit","Infinity"));
if(!Number.isInteger(lastLevel)||lastLevel<8||lastLevel>14||!Number.isInteger(workers)||workers<1||workers>6)throw new Error("Invalid bounded preparation settings.");
const catalog=await readWorldCoverCatalog(),entries=[...catalog.entries.values()];
const levels=Array.from({length:lastLevel-4},(_,i)=>prepareWmtsCoverage(entries,i+5,{includePolar:true}));
const inputs=["runtime/preparedScene.mjs","tools/city/wmts-page-geometry.mjs","tools/city/wmts-polar-geometry.mjs","tools/city/wms-page-geometry.mjs","tools/city/page-geometry.mjs","tools/city/prepare-wmts-tree.mjs","tools/city/encode-prepared-block.mjs","../../platform/prepared-map/prepared-block.mjs","../../platform/prepared-map/prepared-block-transport.mjs","tools/refine-wmts-stubs.mjs"];
const hashes=Object.fromEntries(await Promise.all(inputs.map(async path=>[path,hashBytes(await readFile(new URL(`../${path}`,import.meta.url)))])));
const version=hashBytes(JSON.stringify({schema:1,lastLevel,source:catalog.pin.expectedSha256,hashes})).slice(0,16);
const directory=new URL(`.local/wmts-global/${version}/`,root).pathname;await mkdir(directory,{recursive:true});
const hasTile=coverageLookup(levels),addresses=[];
for(const band of levels.find(l=>l.zoom===8).bands)for(let y=band.y0;y<band.y1;y++)for(const [a,b] of band.ranges)for(let x=a;x<b;x++)addresses.push({zoom:8,x,y});
// Deterministic spatial build order. No destination controls dataset coverage.
const selected=addresses.slice(0,limit),results=[],start=Date.now();
await writeFile(`${directory}/inputs.json`,JSON.stringify({version,dataset:catalog.pin.dataset,sourceSha256:catalog.pin.expectedSha256,hashes,lastLevel,levels,regions:addresses.length},null,2));
console.log(JSON.stringify({directory,version,regions:addresses.length,selected:selected.length,tiles:levels.reduce((sum,l)=>sum+l.tileCount,0),workers}));
let cursor=0,failed=null;
await Promise.all(Array.from({length:Math.min(workers,selected.length)},()=>new Promise((resolve,reject)=>{
  const worker=new Worker(new URL("city/wmts-region-worker.mjs",import.meta.url),{workerData:{directory,levels,dataset:catalog.pin.dataset,version,lastLevel,reserveBytes:8*1024**3}});
  const next=()=>{if(failed||cursor===selected.length){worker.terminate().then(resolve,reject);return;}worker.postMessage(selected[cursor++]);};
  worker.on("message",async result=>{
    if(result.error){failed??=result;console.error(JSON.stringify(result));}
    else results.push(result);
    if(results.length%100===0||failed){
      const progress={completed:results.length,total:selected.length,bytes:results.reduce((s,r)=>s+r.bytes,0),elapsedSeconds:(Date.now()-start)/1000,error:failed};
      console.log(JSON.stringify(progress));await writeFile(`${directory}/progress.json`,JSON.stringify(progress));
    }
    next();
  });
  worker.on("error",error=>{failed??={error:error.stack};reject(error);});next();
})));
if(failed)throw new Error(failed.error);
if(results.length===addresses.length){
  const {finalizeGlobalWmts}=await import("./finalize-global-wmts.mjs");
  const {refineWmtsStubs}=await import("./refine-wmts-stubs.mjs");
  const refined=await refineWmtsStubs(directory,{workers});
  const result=await finalizeGlobalWmts(refined);
  const latest=new URL(".local/wmts-global/latest.json",root);
  await writeFile(new URL(".local/wmts-global/latest.json.part",root),JSON.stringify({version:result.version}));
  await rename(new URL(".local/wmts-global/latest.json.part",root),latest);
  console.log(JSON.stringify({...result,roots:result.roots.length,files:result.files.length}));
}else{
  await writeFile(`${directory}/preflight.json`,JSON.stringify({version,complete:false,regions:results.length,bytes:results.reduce((s,r)=>s+r.bytes,0)}));
}
