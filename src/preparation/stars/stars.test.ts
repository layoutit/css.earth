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
import { sha256, verifiedBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import type { PreparedCssPointField } from '../../renderers/css/stars/types.js';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from '../../renderers/css/stars/validation.js';
import { POINT_FIELD_MAGNITUDE_BOUND } from '../../renderers/css/stars/point-field-bank.js';
import { hierarchyPosition, hierarchyMagnitude, hierarchyRadius } from './precision.js';
import { prepareStarHierarchy } from './hierarchy.js';

const objectDirectory = 'src/objects/stellar-neighbourhood', sourceDirectory = `${objectDirectory}/source`, preparedDirectory = `${objectDirectory}/prepared`;
function coverageCell(x:number,y:number,z:number,divisions:number):number { const ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z),d=Math.max(ax,ay,az); if (!(d>0)) return -1; let face:number,u:number,v:number; if(ax>=ay&&ax>=az){face=x>=0?0:1;u=(x>=0?-z:z)/d;v=y/d;}else if(ay>=az){face=y>=0?2:3;u=x/d;v=(y>=0?-z:z)/d;}else{face=z>=0?4:5;u=(z>=0?x:-x)/d;v=y/d;} const c=(n:number)=>Math.min(divisions-1,Math.max(0,Math.floor((n+1)*divisions/2))); return face*divisions**2+c(v)*divisions+c(u); }
async function payload(): Promise<PreparedCssPointField> {
  const manifest = parsePreparedCssPointFieldManifest((JSON.parse(await readFile(`${preparedDirectory}/stars.json`, 'utf8')) as { data: unknown }).data);
  return decodePreparedCssPointField(manifest, new Uint8Array(await verifiedBytes(preparedDirectory, manifest.bank)));
}
// Hierarchy aggregates are computed from the float32 source magnitudes, before transport quantization.
function assertTree(data: PreparedCssPointField, magnitudeOf = (star: PreparedCssPointField['stars'][number]) => star.absoluteMagnitude): void {
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
      assert(Math.hypot(...star.positionUnits.map((v,axis)=>v-node.positionUnits[axis]!)) <= node.radiusUnits);
      flux += 10**(-.4*magnitudeOf(star));
    }
    assert(Math.abs(10**(-.4*node.absoluteMagnitude)/flux-1) < 1e-12, 'aggregate luminosity must conserve source flux');
  }
  assert.equal(data.nodes[0]?.first,0); assert.equal(data.nodes[0]?.count,data.stars.length); visit(0);
  assert.equal(visited.size,data.nodes.length); assert(covered.every(count=>count===1));
}

test('published aggregate precision removes observed cross-CPU tails without changing source values', () => {
  // Actual Node22 Linux-x64 / Darwin-arm64 results from the same pinned HYG rows.
  assert.deepEqual(hierarchyPosition([-76.99533507712503, 11.941339734320893, -82.57871778264439]),
    hierarchyPosition([-76.995335077125, 11.941339734320895, -82.5787177826444]));
  const magnitudes = [-2.592572389396131, -2.592572389396132];
  assert.equal(hierarchyMagnitude(magnitudes[0]!), hierarchyMagnitude(magnitudes[1]!));
  assert.equal(hierarchyMagnitude(-4.757106367063499), hierarchyMagnitude(-4.757106367063501),
    'Node 22/24 log10 tails at a half-quantum must publish the same magnitude');
  for (const value of magnitudes) assert(Math.abs(10 ** (-.4 * (hierarchyMagnitude(value) - value)) - 1) < 1e-12);
  for (const value of [0, .5e-10, 1e-10, 12.5, 998.12345678905]) {
    assert(hierarchyRadius(value) >= value, 'published radius cannot shrink its actual enclosure');
    assert(hierarchyRadius(value) - value < 1.51e-10);
  }
});

test('enclosing radii are recomputed from the rounded centre and retain exact source astrometry', () => {
  const star = { id: 'rounding-proof', positionUnits: [1.000000000049, 2, 3] as [number, number, number],
    absoluteMagnitude: 1.23456789012345, colorIndex: 0, name: null, coverageAnchor: false };
  const hierarchy = prepareStarHierarchy([star], [[255, 255, 255]], 32, 20), node = hierarchy.nodes[0]!;
  assert.equal(hierarchy.stars[0], star); assert.deepEqual(node.positionUnits, [1, 2, 3]);
  assert(node.radiusUnits >= Math.hypot(...star.positionUnits.map((v, i) => v - node.positionUnits[i]!)));
  assert(node.radiusUnits > 0, 'retaining the pre-rounding zero radius would wrongly cull this source row');
});

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
    // Transport quantization: int16 millimagnitudes on the float32 source grid, within the declared bound.
    assert(Math.abs(star.absoluteMagnitude-mag[sourceIndex]!) <= POINT_FIELD_MAGNITUDE_BOUND); assert(star.colorIndex>=0 && star.colorIndex<32); assert.equal(typeof star.coverageAnchor,'boolean');
  }
  assert.equal(data.stars.filter(star=>star.absoluteMagnitude!==mag[Number(star.id.split(':').at(-1))]).length,2,'only off-grid source magnitudes move');
  const sourceMagnitude = (star: PreparedCssPointField['stars'][number]) => mag[Number(star.id.split(':').at(-1))]!;
  const anchors = data.stars.filter(star=>star.coverageAnchor);
  assert.equal(anchors.length,6*recipe.coverage.faceDivisions**2,'one real apparent-magnitude anchor per all-sky cube cell');
  const best = Array.from({length:6*recipe.coverage.faceDivisions**2},()=>({index:-1,magnitude:Infinity}));
  for(let index=0;index<catalogue.count;index++){const x=p[index*3]!,y=p[index*3+1]!,z=p[index*3+2]!,cell=coverageCell(x,y,z,recipe.coverage.faceDivisions), apparent=mag[index]!+5*Math.log10(Math.hypot(x,y,z))-5; if(apparent<best[cell]!.magnitude)best[cell]={index,magnitude:apparent};}
  assert.deepEqual(new Set(anchors.map(star=>star.id)),new Set(best.map(entry=>`${recipe.catalogue.idPrefix}:${entry.index}`)),'anchors retain the real brightest apparent row for every cube cell');
  assert(data.directPoints); assert.equal(data.directPoints.catalogueCount,catalogue.count); assert.equal(data.directPoints.points.length,data.policy.activeSlots);
  const directRows=new Set(data.directPoints.points.map(point=>point.sourceRow)); assert.equal(directRows.size,data.policy.activeSlots);
  const anchorRows=new Set(anchors.map(star=>Number(star.id.split(':').at(-1))));
  assert([...anchorRows].every(row=>directRows.has(row)),'the bounded direct field must retain every all-sky coverage anchor');
  const expectedRows=Array.from({length:catalogue.count},(_,index)=>({index,anchor:anchorRows.has(index),
    apparent:mag[index]!+5*Math.log10(Math.hypot(p[index*3]!,p[index*3+1]!,p[index*3+2]!))-5}))
    .sort((left,right)=>Number(right.anchor)-Number(left.anchor)||left.apparent-right.apparent||left.index-right.index)
    .slice(0,data.policy.activeSlots).map(entry=>entry.index);
  assert.deepEqual([...directRows].sort((a,b)=>a-b),expectedRows.sort((a,b)=>a-b),'direct stars are the reproducible coverage plus apparent-brightness sample');
  const decodedByRow=new Map(data.stars.map(star=>[Number(star.id.split(':').at(-1)),star]));
  for(const point of data.directPoints.points){const star=decodedByRow.get(point.sourceRow);assert(star);assert.deepEqual(point.positionUnits,star.positionUnits);assert.equal(point.absoluteMagnitude,star.absoluteMagnitude);assert.equal(point.colorIndex,star.colorIndex);assert.equal(point.coverageAnchor,star.coverageAnchor);}
  assertTree(data,sourceMagnitude);
  assert.throws(()=>assertTree({...data,stars:data.stars.slice(1)},sourceMagnitude));
  const firstChild = data.nodes[0]!.children[0]!;
  assert.throws(()=>assertTree({...data,nodes:data.nodes.map((node,index)=>index===firstChild?{...node,first:node.first+1}:node)},sourceMagnitude),/partition/);
});

test('prepared point-field closes every source and image digest and samples the actual photometry chain', async () => {
  const descriptor = JSON.parse(await readFile(`${objectDirectory}/object.json`,'utf8')) as {properties:{preparation:{source:string;sha256:string}};prepared:{url:string;sha256:string}};
  const recipeBytes = await verifiedBytes(objectDirectory,{path:descriptor.properties.preparation.source,sha256:descriptor.properties.preparation.sha256});
  const recipe = parseStarsRecipe(JSON.parse(recipeBytes.toString('utf8')) as unknown);
  const data = await payload();
  await verifiedBytes(objectDirectory,{path:descriptor.prepared.url,sha256:descriptor.prepared.sha256});
  for (const reference of [recipe.catalogue,recipe.provenance,recipe.license,...(recipe.diffuseSky?.faces??[])]) await verifiedBytes(sourceDirectory,reference);
  assert.deepEqual(data.resources.map(resource=>resource.path),['point-atlas.png']); assert.equal(data.diffuseSky,undefined);
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
    assert(Math.abs(sample.radiusPx - (expected?.radiusPx ?? 0)) <= 5.1e-13);
    assert(Math.abs(sample.luminance - Math.min(1,Math.max(0,expected?.luminance??0))) <= 5.1e-13);
    assert(sample.luminance<=1);
  });
  await assert.rejects(()=>verifiedBytes(sourceDirectory,{...recipe.catalogue,sha256:'0'.repeat(64)}),/digest/);
});

test('point-field recipe reproduces identical JSON and all PNG/WEBP bytes into a fresh directory', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(),'cssearth-stars-'));
  try {
    const api = await import(pathToFileURL(resolve('tools/objects/dist/prepare-stars.js')).href) as {prepareStarsObject(options:{objectDirectory:string;outputDirectory:string}):Promise<unknown>};
    await api.prepareStarsObject({objectDirectory,outputDirectory});
    for (const file of ['stars.json','stars.bin']) {
      const canonical = await readFile(`${preparedDirectory}/${file}`), rebuilt = await readFile(join(outputDirectory,file));
      assert.equal(sha256(rebuilt),sha256(canonical),`${file} must rebuild byte-identically`);
    }
    for (const resource of (await payload()).resources) assert.equal(sha256(await readFile(join(outputDirectory,resource.path))),resource.sha256);
  } finally { await rm(outputDirectory,{recursive:true,force:true}); }
});
