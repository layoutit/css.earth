import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { STAR_IDS, starAstrometry, starStateKm, PARSEC_KM } from '@cssearth/astronomy';
import { readCatalog } from '@cssearth/catalog';
import { createExposure, exposureLimits, POINT_MIN_RADIUS_PX, starPresentation } from '@cssearth/engine';
import sharp from 'sharp';
import { parseStarsRecipe } from './config.js';
import { sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { sha256 } from '@cssearth/core/node';
import type { PreparedCssPointField } from '../../renderers/css/stars/types.js';
import { decodePreparedCssPointField, parsePreparedCssPointFieldManifest } from '../../renderers/css/stars/validation.js';
import { POINT_FIELD_MAGNITUDE_BOUND } from '../../renderers/css/stars/point-field-bank.js';
import { hierarchyPosition, hierarchyMagnitude, hierarchyRadius } from './precision.js';
import { prepareStarHierarchy } from './hierarchy.js';

const objectDirectory = 'src/objects/stellar-neighbourhood', sourceDirectory = `${objectDirectory}/source`, preparedDirectory = `${objectDirectory}/prepared`;
function coverageCell(x:number,y:number,z:number,divisions:number):number { const ax=Math.abs(x),ay=Math.abs(y),az=Math.abs(z),d=Math.max(ax,ay,az); if (!(d>0)) return -1; let face:number,u:number,v:number; if(ax>=ay&&ax>=az){face=x>=0?0:1;u=(x>=0?-z:z)/d;v=y/d;}else if(ay>=az){face=y>=0?2:3;u=x/d;v=(y>=0?-z:z)/d;}else{face=z>=0?4:5;u=(z>=0?x:-x)/d;v=y/d;} const c=(n:number)=>Math.min(divisions-1,Math.max(0,Math.floor((n+1)*divisions/2))); return face*divisions**2+c(v)*divisions+c(u); }
async function payload(): Promise<PreparedCssPointField> {
  const manifest = parsePreparedCssPointFieldManifest((JSON.parse(await readFile(`${preparedDirectory}/stars.json`, 'utf8')) as { data: unknown }).data);
  return decodePreparedCssPointField(manifest, new Uint8Array(await sourceBytes(preparedDirectory, manifest.bank)));
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

test('prepared point-field closes every source and image digest and samples the actual photometry chain', async () => {
  const descriptor = JSON.parse(await readFile(`${objectDirectory}/object.json`,'utf8')) as {properties:{preparation:{source:string}};prepared:{url:string}};
  const recipeBytes = await readFile(`${objectDirectory}/${descriptor.properties.preparation.source}`);
  const recipe = parseStarsRecipe(JSON.parse(recipeBytes.toString('utf8')) as unknown);
  const data = await payload();
  const manifest = JSON.parse(await readFile(`${preparedDirectory}/stars.json`, 'utf8'));
  // The baked provenance is published beside the manifest the page loads, not inside it.
  assert.equal(manifest.data.provenance, undefined);
  const { provenance } = JSON.parse(await readFile(`${preparedDirectory}/stars-provenance.json`, 'utf8'));
  assert.equal(provenance.catalogueMetadata.epoch, 'ICRS/J2000.0 equinox and coordinate epoch');
  assert.match(provenance.reconciliation.sourceEpochDescription, /J1991.25/);
  // Direct points carry float32 values in at most nine significant digits, not the seventeen of the double they widen to.
  for (const point of manifest.data.directPoints.points) for (const value of [...point.positionUnits, point.absoluteMagnitude]) {
    assert.ok(String(value).replace(/^-|e.*$|\./g, '').replace(/^0+/, '').length <= 9, `${value} carries more digits than a float32`);
  }
  for (const reference of [recipe.catalogue,recipe.provenance,recipe.license,...(recipe.diffuseSky?.faces??[])]) await sourceBytes(sourceDirectory,reference);
  assert.deepEqual(data.resources.map(resource=>resource.path),['point-atlas.webp']); assert.equal(data.diffuseSky,undefined);
  for (const resource of data.resources) {
    const bytes = await sourceBytes(preparedDirectory,resource); assert.equal(bytes.length,resource.bytes);
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
});

