import { sha256 } from '../../../../src/platform/sha256.mts';
import { parentPort, workerData } from "node:worker_threads";
import { mkdir, readFile, writeFile, rename, statfs } from "node:fs/promises";

import { coverageLookup, prepareRegionPack} from "../prepare-wmts-tree.mts";
import { parseGeographicScene, parseCoverage, parseRegionReceipt, shape, array, text, number } from '../source-records.mts';
import { hasErrorCode } from '../../../sources/source-values.mts';
const {scene,assetPath,directory,levels,dataset,version,lastLevel,reserveBytes}=shape({scene:parseGeographicScene,assetPath:text,directory:text,levels:array(parseCoverage),dataset:text,version:text,lastLevel:number,reserveBytes:number})(workerData);
if (!parentPort) throw new Error('WMTS region worker requires a parent port');
const port=parentPort;
const hasTile=coverageLookup(levels);
await mkdir(directory,{recursive:true});
port.on("message",async (value: unknown)=>{ const address=shape({zoom:number,x:number,y:number})(value);
  const name=`${address.zoom}-${address.x}-${address.y}`,path=`${directory}/${name}.pack`,manifest=`${directory}/${name}.json`;
  try{
    try{
      const saved=parseRegionReceipt(JSON.parse(await readFile(manifest,"utf8"))),bytes=await readFile(path);
      if(saved.version!==version||saved.sha256!==sha256(bytes))throw new Error("Prepared pack integrity mismatch.");
      port.postMessage({...saved,reused:true});return;
    }catch(error){if(!hasErrorCode(error,"ENOENT"))throw error;}
    const disk=await statfs(directory);if(disk.bavail*disk.bsize<reserveBytes)throw new Error("Preparation stopped at the free-disk reserve.");
    const start=performance.now(),pack=prepareRegionPack(address,scene,hasTile,dataset,version,{lastLevel,assetPath});
    const result={address,version,root:pack.root,sha256:pack.sha256,bytes:pack.bytes.length,tiles:pack.tiles,leaves:pack.leaves,sections:pack.sections,elapsedMs:performance.now()-start};
    await writeFile(`${path}.part`,pack.bytes);await rename(`${path}.part`,path);
    await writeFile(`${manifest}.part`,JSON.stringify(result));await rename(`${manifest}.part`,manifest);
    port.postMessage(result);
  }catch(error){port.postMessage({address,error:error instanceof Error ? error.stack : String(error)});}
});
