import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { CITY_PAGE_PIXELS, CITY_PAGE_GUTTER, pageKey, prepareCityPageGeometry } from "../page-geometry.mts";
import { resamplePageRgba } from "./resample-page.mts";

import type { GeographicScene, PageGeometry, PreparedCityPage, CorePage, PageAddress } from '../contracts.mts';
const side = CITY_PAGE_PIXELS;
const gutter = CITY_PAGE_GUTTER;

// Exact 2x area reduction, with premultiplied alpha. Missing quadrants stay
// transparent; they are not promoted to city-resolution coverage.
export function assembleParentCore(children: readonly { pixels: Uint8Array; x: number; y: number }[], size = side) {
  const output = Buffer.alloc(size * size * 4);
  for (const { pixels, x, y } of children) {
    const reduced = resamplePageRgba(pixels, size, size,
      {x0:0,y0:0,x1:size,y1:size},size/2,size/2);
    const left = (x % 2) * size / 2;
    const top = (1 - y % 2) * size / 2;
    for (let row = 0; row < size / 2; row++) reduced.copy(output,
      ((top + row) * size + left) * 4, row * size / 2 * 4, (row + 1) * size / 2 * 4);
  }
  return output;
}

export function preparedCoverageCorners(children: readonly { coverageCorners?: number[][]; corners: number[][] }[]) {
  const points = children.flatMap(child => child.coverageCorners ?? child.corners);
  const low = [0,1,2].map(axis => Math.min(...points.map(point => point[axis])));
  const high = [0,1,2].map(axis => Math.max(...points.map(point => point[axis])));
  return [0,1].flatMap(x => [0,1].flatMap(y => [0,1].map(z =>
    [x ? high[0] : low[0], y ? high[1] : low[1], z ? high[2] : low[2]])));
}

export function copyCoreIntoGutter(output: Buffer,core: Buffer,dx: number,dy: number,size=side,padding=gutter) {
  const width=size+padding*2;
  const originX=padding+dx*size,originY=padding-dy*size;
  const left=Math.max(0,originX),right=Math.min(width,originX+size);
  const top=Math.max(0,originY),bottom=Math.min(width,originY+size);
  for(let y=top;y<bottom;y++)core.copy(output,(y*width+left)*4,
    ((y-originY)*size+left-originX)*4,((y-originY)*size+right-originX)*4);
}

export async function writeCityCore(path: string, pixels: Uint8Array, page: Pick<PageGeometry, 'width' | 'height'>) {
  const core = await sharp(pixels, { raw:{width:page.width,height:page.height,channels:4} })
    .extract({left:gutter,top:gutter,width:side,height:side}).png().toBuffer();
  await writeFile(path,core);
}

// Only preparation reads these lossless cores. At most four source cores and
// one output are needed to build a parent, irrespective of dataset size.
export async function prepareCityParentPages(seeds: CorePage[], directory: string, scene: GeographicScene, publish: (page: PreparedCityPage,pixels: Buffer) => Promise<void>) {
  const highestLevel=Math.max(...seeds.map(page=>page.level));
  const seedKeys=new Set(seeds.map(page=>page.key));
  for(const seed of seeds)for(let level=seed.level-1;level>=0;level--) {
    const factor=2**(seed.level-level);
    if(seedKeys.has(pageKey({level,x:Math.floor(seed.x/factor),y:Math.floor(seed.y/factor)}))) {
      throw new Error('Prepared source regions must not overlap through ancestor addresses.');
    }
  }
  let levelPages = new Map(seeds.filter(page=>page.level===highestLevel).map(page => [page.key,page]));
  for (let level = highestLevel - 1; level >= 0; level--) {
    const groups = new Map<string, { address: PageAddress; children: CorePage[] }>();
    for (const child of levelPages.values()) {
      const address = {level,x:Math.floor(child.x/2),y:Math.floor(child.y/2)};
      const key = pageKey(address);
      if (!groups.has(key)) groups.set(key,{address,children:[]});
      groups.get(key)!.children.push(child);
    }
    const parents = new Map<string, CorePage & { children: string[] }>();
    for (const [key,{address,children}] of groups) {
      const sources = [];
      for (const child of children) sources.push({...child,
        pixels:await sharp(await readFile(child.corePath)).raw().toBuffer()});
      const core = assembleParentCore(sources);
      const corePath = resolve(directory,`${key}.png`);
      await sharp(core,{raw:{width:side,height:side,channels:4}}).png().toFile(corePath);
      parents.set(key,{...prepareCityPageGeometry(address,scene),corePath,
        children:children.map(child=>child.key).sort(),childrenCoverImage:true,
        coverageCorners:preparedCoverageCorners(children)});
    }
    const levelSources = new Map([...parents,...seeds.filter(page=>page.level===level).map(page=>[page.key,page] as const)]);
    // Gutters use neighboring cores at this exact level. Never derive them by
    // stretching an edge or repeatedly decoding lossy child WebPs.
    for (const parent of parents.values()) {
      const pixels = Buffer.alloc(parent.width * parent.height * 4);
      const columns = 32 * 2 ** level;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const neighbor = levelSources.get(pageKey({level,x:(parent.x+dx+columns)%columns,y:parent.y+dy}));
        if (!neighbor) continue;
        // Face-local coordinates are continuous only inside one coarse face.
        // The neighboring face has its own overlapping, reprojected apron.
        // Copying its pixels here would import a different geographic strip.
        const factor=2**level;
        if(Math.floor(neighbor.x/factor)!==Math.floor(parent.x/factor)||
           Math.floor(neighbor.y/factor)!==Math.floor(parent.y/factor))continue;
        const core = await sharp(await readFile(neighbor.corePath)).raw().toBuffer();
        copyCoreIntoGutter(pixels,core,dx,dy);
      }
      const {corePath,...prepared} = parent;
      await publish(prepared,pixels);
    }
    levelPages = levelSources;
  }
}

