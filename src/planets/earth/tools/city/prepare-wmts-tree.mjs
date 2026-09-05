import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { prepareWmtsTile } from "./wmts-page-geometry.mjs";
import { encodePreparedBlock, packWmtsRecords } from "./encode-prepared-block.mjs";
import { PREPARED_BLOCK_ENCODING } from "../../../../platform/prepared-map/prepared-block-transport.mjs";

export const tileKey = ({zoom,x,y}) => `wmts-tile-${zoom}-${x}-${y}`;
export const hashBytes = bytes => createHash("sha256").update(bytes).digest("hex");
export function coverageLookup(levels) {
  const rows=new Map(levels.map(level=>[level.zoom,Array.from({length:2**level.zoom},()=>null)]));
  for(const level of levels)for(const band of level.bands)for(let y=band.y0;y<band.y1;y++)rows.get(level.zoom)[y]=band.ranges;
  return ({zoom,x,y}) => rows.get(zoom)?.[y]?.some(([a,b])=>x>=a&&x<b)??false;
}
export function prepareTileNode(address,scene,{images=true}={}) {
  const all=prepareWmtsTile(address,scene);
  if(!all.length)throw new Error(`No prepared geometry for ${tileKey(address)}.`);
  const points=all.flatMap(page=>page.corners),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a]);}
  const normal=all[0].normal;
  const normalSlack=Math.max(...all.map(p=>Math.hypot(...p.normal.map((v,i)=>v-normal[i]))));
  // At small scale the accepted base cap supplies imagery. Its nonlinear
  // mapping would otherwise consume the retained pool with tiny patches.
  const pages=images?all.filter(page=>address.zoom>=10||!["0-0-0","0-0-15"].includes(page.coarseKey)):[];
  return {node:{key:tileKey(address),level:address.zoom,
    corners:Array.from({length:8},(_,i)=>[0,1,2].map(a=>(i>>a&1?hi:lo)[a])),normal,normalSlack,
    pages:pages.map(page=>page.key),children:[],maximumCssSpan:384},pages};
}
export function childrenOf({zoom,x,y}) {
  return [[0,0],[1,0],[0,1],[1,1]].map(([dx,dy])=>({zoom:zoom+1,x:x*2+dx,y:y*2+dy}));
}

// Each section carries a small complete subtree. Descendants in other
// independently compressed sections are prepared stubs, never geographic math.
export function prepareTreeSection(address,lastLevel,scene,hasTile,externalFor,dataset) {
  const nodes=[],records=[],external=[];
  const visit=address=>{
    const {node,pages}=prepareTileNode(address,scene);nodes.push(node);records.push(...pages);
    for(const child of childrenOf(address).filter(hasTile)){
      if(child.zoom<=lastLevel){node.children.push(tileKey(child));visit(child);}
      else {const stub=externalFor?.(child);if(stub){node.children.push(stub.key);external.push(stub);}}
    }
  };
  visit(address);
  if(!records.length)throw new Error(`Empty prepared WMTS section ${tileKey(address)}.`);
  const decoded=encodePreparedBlock(packWmtsRecords(records),{envelope:{schema:"cssearth-city-index@1",dataset,nodes,external}});
  const bytes=gzipSync(decoded,{level:6});
  return {bytes,root:nodes[0],tiles:nodes.length,leaves:records.length,ref:{encoding:PREPARED_BLOCK_ENCODING,bytes:bytes.length,sha256:hashBytes(bytes),decodedBytes:decoded.length,decodedSha256:hashBytes(decoded)}};
}

export function prepareRegionPack(address,scene,hasTile,dataset,version,{lastLevel=14}={}) {
  const url=`/scenes/earth/wmts-${version}/${address.zoom}-${address.x}-${address.y}.pack`;
  const parts=[],stubs=new Map();let offset=0,tiles=0,leaves=0;
  const append=section=>{
    const ref={...section.ref,url,offset};offset+=section.bytes.length;parts.push(section.bytes);
    const {pages,children,...bounds}=section.root;
    const stub={...bounds,stub:true,directory:ref};stubs.set(stub.key,stub);
    tiles+=section.tiles;leaves+=section.leaves;return stub;
  };
  if(lastLevel>10){
    const descend=parent=>{
      if(parent.zoom===11){append(prepareTreeSection(parent,lastLevel,scene,hasTile,null,dataset));return;}
      for(const child of childrenOf(parent).filter(hasTile))descend(child);
    };
    descend(address);
  }
  const root=append(prepareTreeSection(address,Math.min(10,lastLevel),scene,hasTile,child=>stubs.get(tileKey(child)),dataset));
  const bytes=Buffer.concat(parts);
  return {bytes,root,tiles,leaves,sections:parts.length,sha256:hashBytes(bytes)};
}
