import { sha256 } from '../../../../src/platform/sha256.mts';
import { parseGeographicScene, parseGlobalInputs, parseRegionReceipt } from '../source-records.mts';
import { readFile,writeFile,stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";

import { coverageLookup,prepareTreeSection,prepareTileNode,childrenOf,tileKey } from "../prepare-wmts-tree.mts";
import { encodePreparedBlock } from "../encode-prepared-block.mts";
import { prepareWmtsTile } from "../wmts-page-geometry.mts";
import { PREPARED_BLOCK_ENCODING } from "../../../../src/platform/prepared-map/prepared-block-transport.mts";
import {commandContext} from './context.mts';

import type { OperationContext } from './context.mts';
import type { TileStub, TileNode, TileAddress } from '../contracts.mts';
export async function finalizeGlobalWmts(directory: string,{context,verify=true}: { context?: OperationContext; verify?: boolean }={}){
  if(!context)throw new TypeError('Finalization requires its selected object context.');
  const scene=await context.readPrepared('scene',parseGeographicScene);
  const inputs=parseGlobalInputs(JSON.parse(await readFile(`${directory}/inputs.json`,"utf8"))),{version,levels,dataset}=inputs;
  for(const [path,expected]of Object.entries(inputs.hashes))if(sha256(await readFile(context.projectUrl(path)))!==expected)throw new Error(`Preparation input changed: ${path}`);
  const hasTile=coverageLookup(levels),regions=[],stubs=new Map<string,TileStub>(),coarse=[],roots=[];
  for(const band of levels.find(l=>l.zoom===8)!.bands)for(let y=band.y0;y<band.y1;y++)for(const [a,b]of band.ranges)for(let x=a;x<b;x++){
    const name=`8-${x}-${y}`,saved=parseRegionReceipt(JSON.parse(await readFile(`${directory}/${name}.json`,"utf8")));
    if(saved.version!==version||saved.address.x!==x||saved.address.y!==y)throw new Error(`Invalid global region ${name}.`);
    const path=`${directory}/${name}.pack`;
    if((await stat(path)).size!==saved.bytes||verify&&sha256(await readFile(path))!==saved.sha256)throw new Error(`Prepared pack changed: ${name}.`);
    regions.push({filename:`${name}.pack`,bytes:saved.bytes,sha256:saved.sha256,tiles:saved.tiles,leaves:saved.leaves});stubs.set(saved.root.key,saved.root);
  }
  for(const band of levels[0].bands)for(let y=band.y0;y<band.y1;y++)for(const [a,b]of band.ranges)for(let x=a;x<b;x++){
    const address={zoom:5,x,y};let section;
    try{section=prepareTreeSection(address,7,scene,hasTile,child=>stubs.get(tileKey(child)),dataset);}
    catch(error){
      if(!(error instanceof Error)||!error.message.startsWith("Empty prepared WMTS section"))throw error;
      const nodes: TileNode[]=[],external: TileStub[]=[];
      const visit=(address: TileAddress): void=>{
        const {node,pages}=prepareTileNode(address,scene);if(pages.length)throw new Error("Unexpected image in metadata-only polar subtree.");nodes.push(node);
        for(const child of childrenOf(address).filter(hasTile)){
          node.children.push(tileKey(child));if(child.zoom<=7)visit(child);else{const stub=stubs.get(tileKey(child));if(!stub)throw new Error("Missing global polar region.");external.push(stub);}
        }
      };visit(address);
      const decoded=encodePreparedBlock([{metadataOnly:true}],{envelope:{schema:"cssearth-city-index@1",dataset,nodes,external,metadataOnly:true}}),bytes=gzipSync(decoded,{level:6});
      section={root:nodes[0],tiles:nodes.length,leaves:0,bytes,ref:{encoding:PREPARED_BLOCK_ENCODING,bytes:bytes.length,sha256:sha256(bytes),decodedBytes:decoded.length,decodedSha256:sha256(decoded)}};
    }
    const filename=`5-${x}-${y}.pack`,ref={...section.ref,url:`${context.assetPath}wmts-${version}/${filename}`,offset:0};await writeFile(`${directory}/${filename}`,section.bytes);
    const groups=new Map<string,{normal:number[];lo:number[];hi:number[]}>();
    for(const page of prepareWmtsTile(address,scene)){
      if(!groups.has(page.coarseKey))groups.set(page.coarseKey,{normal:page.normal,lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]});
      const g=groups.get(page.coarseKey)!;for(const p of page.corners)for(let i=0;i<3;i++){g.lo[i]=Math.min(g.lo[i],p[i]);g.hi[i]=Math.max(g.hi[i],p[i]);}
    }
    const coverageParts=[...groups.values()].map(({normal,lo,hi})=>({normal,corners:Array.from({length:8},(_,i)=>[0,1,2].map(a=>(i>>a&1?hi:lo)[a]))}));
    const {pages,children,...bounds}=section.root;roots.push({...bounds,coverageParts,stub:true,directory:ref});
    coarse.push({filename,bytes:section.bytes.length,sha256:sha256(section.bytes),tiles:section.tiles,leaves:section.leaves});
  }
  const files=[...regions,...coarse],tiles=files.reduce((s,p)=>s+p.tiles,0),expectedTiles=levels.reduce((s,l)=>s+l.tileCount,0);
  if(tiles!==expectedTiles)throw new Error(`Global tile inventory mismatch: ${tiles} / ${expectedTiles}`);
  const manifest={schema:"cssearth-global-wmts@1",version,dataset,directory,complete:true,lastLevel:inputs.lastLevel,sourceSha256:inputs.sourceSha256,
    regions:regions.length,expectedRegions:inputs.regions,tiles,expectedTiles,leaves:files.reduce((s,p)=>s+p.leaves,0),bytes:files.reduce((s,p)=>s+p.bytes,0),roots,files,
    verifiedAt:new Date().toISOString(),packHashesVerified:verify,qualification:"Prepared placement for all published WorldCover source footprints within Web Mercator. Source footprints include water and no-data; imagery availability follows the provider. Uncovered areas retain Blue Marble."};
  await writeFile(`${directory}/manifest.json`,JSON.stringify(manifest));
  return manifest;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
  const context=commandContext();
  const directory=context.args[0];if(!directory)throw new Error("A prepared global directory is required.");
  const result=await finalizeGlobalWmts(directory,{context});console.log(JSON.stringify({...result,roots:result.roots.length,files:result.files.length}));
}
