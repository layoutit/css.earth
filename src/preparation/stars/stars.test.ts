import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCatalog } from '@cssearth/catalog';
import { createExposure, exposureLimits, POINT_MIN_RADIUS_PX, starPresentation } from '@cssearth/engine';
import sharp from 'sharp';
import { parseStarsRecipe } from './config.js';
import { sha256, verifiedBytes } from '../volume/source.js';
import type { PreparedCssPointField } from './types.js';

const objectDirectory = 'src/objects/stellar-neighbourhood', sourceDirectory = `${objectDirectory}/source`, preparedDirectory = `${objectDirectory}/prepared`;
function coverageCell(x:number,y:number,z:number,divisions:number):number { const ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z),d=Math.max(ax,ay,az); if (!(d>0)) return -1; let face:number,u:number,v:number; if(ax>=ay&&ax>=az){face=x>=0?0:1;u=(x>=0?-z:z)/d;v=y/d;}else if(ay>=az){face=y>=0?2:3;u=x/d;v=(y>=0?-z:z)/d;}else{face=z>=0?4:5;u=(z>=0?x:-x)/d;v=y/d;} const c=(n:number)=>Math.min(divisions-1,Math.max(0,Math.floor((n+1)*divisions/2))); return face*divisions**2+c(v)*divisions+c(u); }
async function payload(): Promise<PreparedCssPointField> {
  const value = JSON.parse(await readFile(`${preparedDirectory}/stars.json`, 'utf8')) as { data: PreparedCssPointField };
  return value.data;
}
function assertTree(data: PreparedCssPointField): void {
  const covered = new Uint8Array(data.stars.length), visited = new Set<number>();
  function visit(index: number): void {
    assert(!visited.has(index), 'tree cannot repeat a node'); visited.add(index);
    const node = data.nodes[index]; assert(node);
    assert(node.count > 0 && node.first >= 0 && node.first + node.count <= data.stars.length);
    if (node.children.length) {
      let next = node.first;
      for (const childIndex of node.children) { const child = data.nodes[childIndex]; assert(child); assert.equal(child.first, next, 'children must partition a contiguous parent range'); next += child.count; visit(childIndex); }
      assert.equal(next, node.first + node.count);
    } else {
      assert(node.count <= 32);
      for (let i=node.first;i<node.first+node.count;i++) covered[i]!++;
    }
    let flux = 0;
    for (let i=node.first;i<node.first+node.count;i++) {
      const star = data.stars[i]!;
      assert(Math.hypot(...star.positionUnits.map((v,axis)=>v-node.positionUnits[axis]!)) <= node.radiusUnits + 1e-10);
      flux += 10**(-.4*star.absoluteMagnitude);
    }
    assert(Math.abs(10**(-.4*node.absoluteMagnitude)/flux-1) < 1e-12, 'aggregate luminosity must conserve source flux');
  }
  assert.equal(data.nodes[0]?.first,0); assert.equal(data.nodes[0]?.count,data.stars.length); visit(0);
  assert.equal(visited.size,data.nodes.length); assert(covered.every(count=>count===1));
}

test('full source catalogue survives at exact Cartesian positions in a bounded-leaf partition', async () => {
  const data = await payload();
  const recipe = parseStarsRecipe(JSON.parse(await readFile(`${sourceDirectory}/stars.json`,'utf8')) as unknown);
  const catalogue = readCatalog(Uint8Array.from(await verifiedBytes(sourceDirectory,recipe.catalogue)).buffer);
  const p = catalogue.numeric('posPc'), mag = catalogue.numeric('absMag'); assert(p instanceof Float32Array && mag instanceof Float32Array);
  assert.equal(data.stars.length,109389); assert.equal(data.stars.length,catalogue.count);
  const ids = new Set<string>();
  for (const star of data.stars) {
    assert(!ids.has(star.id)); ids.add(star.id);
    const sourceIndex = Number(star.id.split(':').at(-1)); assert(Number.isSafeInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < catalogue.count);
    assert.deepEqual(star.positionUnits,[p[sourceIndex*3],p[sourceIndex*3+1],p[sourceIndex*3+2]]);
    assert.equal(star.absoluteMagnitude,mag[sourceIndex]); assert(star.colorIndex>=0 && star.colorIndex<32); assert.equal(typeof star.coverageAnchor,'boolean');
  }
  const anchors = data.stars.filter(star=>star.coverageAnchor);
  assert.equal(anchors.length,6*recipe.coverage.faceDivisions**2,'one real apparent-magnitude anchor per all-sky cube cell');
  const best = Array.from({length:6*recipe.coverage.faceDivisions**2},()=>({index:-1,magnitude:Infinity}));
  for(let index=0;index<catalogue.count;index++){const x=p[index*3]!,y=p[index*3+1]!,z=p[index*3+2]!,cell=coverageCell(x,y,z,recipe.coverage.faceDivisions), apparent=mag[index]!+5*Math.log10(Math.hypot(x,y,z))-5; if(apparent<best[cell]!.magnitude)best[cell]={index,magnitude:apparent};}
  assert.deepEqual(new Set(anchors.map(star=>star.id)),new Set(best.map(entry=>`${recipe.catalogue.idPrefix}:${entry.index}`)),'anchors retain the real brightest apparent row for every cube cell');
  assertTree(data);
  assert.throws(()=>assertTree({...data,stars:data.stars.slice(1)}));
  const firstChild = data.nodes[0]!.children[0]!;
  assert.throws(()=>assertTree({...data,nodes:data.nodes.map((node,index)=>index===firstChild?{...node,first:node.first+1}:node)}),/partition/);
});

test('prepared point-field closes every source and image digest and samples the actual photometry chain', async () => {
  const descriptor = JSON.parse(await readFile(`${objectDirectory}/object.json`,'utf8')) as {properties:{preparation:{source:string;sha256:string}};prepared:{url:string;sha256:string}};
  const recipeBytes = await verifiedBytes(objectDirectory,{path:descriptor.properties.preparation.source,sha256:descriptor.properties.preparation.sha256});
  const recipe = parseStarsRecipe(JSON.parse(recipeBytes.toString('utf8')) as unknown);
  const data = await payload();
  await verifiedBytes(objectDirectory,{path:descriptor.prepared.url,sha256:descriptor.prepared.sha256});
  for (const reference of [recipe.catalogue,recipe.provenance,recipe.license,...(recipe.diffuseSky?.faces??[])]) await verifiedBytes(sourceDirectory,reference);
  assert.equal(data.resources.length,7); assert.equal(data.diffuseSky?.length,6);
  for (const resource of data.resources) {
    const bytes = await verifiedBytes(preparedDirectory,resource); assert.equal(bytes.length,resource.bytes);
    const metadata = await sharp(bytes).metadata(); assert.equal(metadata.width,resource.width); assert.equal(metadata.height,resource.height);
  }
  const atlas = await sharp(`${preparedDirectory}/${data.atlas.path}`).raw().toBuffer();
  assert(atlas.some((v,i)=>i%4===3 && v>240),'atlas must contain an opaque core');
  assert.equal(atlas[3],0,'profile corner must be transparent');
  const exposure = createExposure({fovDegrees:60,screenFactor:1}), limits=exposureLimits(exposure); assert.equal(data.photometry.samples.length,1201); assert.equal(data.photometry.floor,recipe.photometry.floor); assert.equal(data.photometry.limitingMagnitude,limits.limitingMagnitude); assert.equal(data.photometry.hintsLimitMagnitude,limits.hintsLimitMagnitude); assert.equal(data.photometry.minimumRadiusPx,POINT_MIN_RADIUS_PX); assert.deepEqual(data.labels,recipe.labels);
  data.photometry.samples.forEach((sample,index)=>{
    const expected = starPresentation(exposure,-25+index*.05);
    assert.deepEqual(sample,{radiusPx:expected?.radiusPx??0,luminance:Math.min(1,Math.max(0,expected?.luminance??0))}); assert(sample.luminance<=1);
  });
  await assert.rejects(()=>verifiedBytes(sourceDirectory,{...recipe.catalogue,sha256:'0'.repeat(64)}),/digest/);
});

test('point-field recipe reproduces identical JSON and all PNG/WEBP bytes into a fresh directory', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(),'cssearth-stars-'));
  try {
    const api = await import(pathToFileURL(resolve('tools/objects/dist/prepare-stars.js')).href) as {prepareStarsObject(options:{objectDirectory:string;outputDirectory:string}):Promise<unknown>};
    await api.prepareStarsObject({objectDirectory,outputDirectory});
    const canonical = await readFile(`${preparedDirectory}/stars.json`), rebuilt = await readFile(join(outputDirectory,'stars.json'));
    assert.equal(sha256(rebuilt),sha256(canonical));
    for (const resource of (await payload()).resources) assert.equal(sha256(await readFile(join(outputDirectory,resource.path))),resource.sha256);
  } finally { await rm(outputDirectory,{recursive:true,force:true}); }
});
