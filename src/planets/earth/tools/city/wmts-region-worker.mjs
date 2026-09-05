import { parentPort, workerData } from "node:worker_threads";
import { mkdir, readFile, writeFile, rename, statfs } from "node:fs/promises";
import { PREPARED_EARTH_SCENE as scene } from "../../runtime/preparedScene.mjs";
import { coverageLookup, prepareRegionPack, hashBytes } from "./prepare-wmts-tree.mjs";
const {directory,levels,dataset,version,lastLevel,reserveBytes}=workerData;
const hasTile=coverageLookup(levels);
await mkdir(directory,{recursive:true});
parentPort.on("message",async address=>{
  const name=`${address.zoom}-${address.x}-${address.y}`,path=`${directory}/${name}.pack`,manifest=`${directory}/${name}.json`;
  try{
    try{
      const saved=JSON.parse(await readFile(manifest,"utf8")),bytes=await readFile(path);
      if(saved.version!==version||saved.sha256!==hashBytes(bytes))throw new Error("Prepared pack integrity mismatch.");
      parentPort.postMessage({...saved,reused:true});return;
    }catch(error){if(error.code!=="ENOENT")throw error;}
    const disk=await statfs(directory);if(disk.bavail*disk.bsize<reserveBytes)throw new Error("Preparation stopped at the free-disk reserve.");
    const start=performance.now(),pack=prepareRegionPack(address,scene,hasTile,dataset,version,{lastLevel});
    const result={address,version,root:pack.root,sha256:pack.sha256,bytes:pack.bytes.length,tiles:pack.tiles,leaves:pack.leaves,sections:pack.sections,elapsedMs:performance.now()-start};
    await writeFile(`${path}.part`,pack.bytes);await rename(`${path}.part`,path);
    await writeFile(`${manifest}.part`,JSON.stringify(result));await rename(`${manifest}.part`,manifest);
    parentPort.postMessage(result);
  }catch(error){parentPort.postMessage({address,error:error.stack});}
});
