import { required, fixtureRecord } from '../../contract/test-values.mts';
import { shape, array, text, number, optional, parseShapeLens } from './source-records.mts';
import { requireArray, requireRecord } from '../../sources/source-values.mts';
import { fixtureSource } from '../test-source-fixture.mts';
import type { RadialMaterialSurface } from './solid-contract.mts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { BASE_TILE } from '@layoutit/polycss';
import { parseObjShape, createShapeSurfaceSampler } from './obj-shape.mts';
import { prepareRadialMaterials } from './radial-terrain.mts';

const parseFixture = shape({cases:array(shape({id:text,sourcePath:text,oldFirstRayHeight:number,
 triangles:array(shape({sourceFace:number,vertices:array(array(number))})),
 checks:array(shape({kind:text,query:array(number),expectedPoint:array(number),expectedValue:number,expectedDistanceMeters:number,sourceFace:optional(number)})),
 oldRadialGrid:optional(shape({longitude:number,latitude:number,cornerRadii:array(number),scalarValue:number,width:number,height:number}))}))});
const fixtures = parseFixture(JSON.parse(await readFile(new URL('./fixtures/source-surface-cases.json', import.meta.url), 'utf8')));
const near = (actual: number, expected: number, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance,
  `Expected ${expected}, received ${actual}`);

for (const fixture of fixtures.cases) test(`${fixture.id}: full-source regression coordinates keep height on the corresponding surface`, async () => {
  const root = new URL(`../../../src/objects/${fixture.id}/source/`, import.meta.url);
  const [config, manifest] = await Promise.all(['preparation/terrestrial.json', 'manifest.json'].map(async path => JSON.parse(await readFile(new URL(path, root), 'utf8'))));
  const entry = required(requireArray(manifest.inputs).map(value=>fixtureRecord(value)).find(input => input.path === fixture.sourcePath));
  const lens = parseShapeLens(required(requireArray(config.raster.scientific).find(value => fixtureRecord(value).id === 'elevation')));
  // These are exact source facets, not a synthetic approximation of a body.
  // verify-source-surface.py independently checks the fixture against every
  // triangle of the full pinned source, including the 3.37M-face Bennu mesh.
  const vertices = fixture.triangles.flatMap(face => face.vertices);
  const obj = vertices.map(v => `v ${v.join(' ')}`).concat(fixture.triangles.map((_, i) => `f ${i*3+1} ${i*3+2} ${i*3+3}`)).join('\n');
  const mesh = parseObjShape(obj, { metersPerUnit: 1, expectedVertices: vertices.length, expectedFaces: fixture.triangles.length });
  const sample = createShapeSurfaceSampler(mesh, lens);
  for (const check of fixture.checks) {
    const result = sample.samplePoint(check.query);
    assert.ok(result, `${check.kind} must remain within the authored source-distance allowance`);
    result.point.forEach((n, i) => near(n, check.expectedPoint[i]));
    near(result.value, check.expectedValue);
    near(result.distanceMeters, check.expectedDistanceMeters);
    if (check.sourceFace !== undefined) assert.equal(fixture.triangles[result.faceId].sourceFace, check.sourceFace);
    assert.ok(result.value - fixture.oldFirstRayHeight > (fixture.id === 'eros' ? .7 : 5), 'Must not collapse back to the innermost radial height');
  }
  const p = fixture.checks[0].query, radius = Math.hypot(...p);
  const lon = Math.atan2(p[1], p[0])*180/Math.PI, lat = Math.asin(p[2]/radius)*180/Math.PI;
  const first = mesh.hit(lon, lat);
  near(required(first).radius*required(lens.valueTransform).scale+required(lens.valueTransform).offset, fixture.oldFirstRayHeight);
  assert.equal(mesh.hit(lon, lat, true), null, 'Flat preview cannot claim one scalar for these multiple source surfaces');
  if (fixture.oldRadialGrid) {
    const old = fixture.oldRadialGrid;
    assert.deepEqual(lens.sampleGrid, { width: old.width, height: old.height });
    // Preserve the reviewed delivered-grid cases as well as exact ray hits:
    // Itokawa +2.996 versus +89.332 m, Ryugu's wrong sign, Eros 799.276 m.
    const x = old.longitude / 360 * (old.width - 1), y = (90 - old.latitude) / 180 * (old.height - 1);
    const u = x - Math.floor(x), v = y - Math.floor(y), [a,b,c,d] = old.cornerRadii;
    const radius = (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
    near(radius*required(lens.valueTransform).scale+required(lens.valueTransform).offset, old.scalarValue);
    const outer = fixture.checks.find((check) => check.kind === 'exact-outer-source-ray-surface');
    const corrected = required(sample.samplePoint(required(outer).query)).value;
    const errorMeters = (corrected - old.scalarValue) / required(lens.valueTransform).scale;
    assert.ok(errorMeters > required(new Map([['itokawa',86],['ryugu',46],['eros',799]]).get(fixture.id)));
    if (fixture.id === 'ryugu') assert.ok(old.scalarValue < 0 && corrected > 0);
  }
});

test('the delivered scientific atlas samples source geometry, not the lossy flat preview', async () => {
  const root = await mkdtemp(join(tmpdir(), 'source-surface-atlas-'));
  try {
    // Both source triangles occupy the same center-ray directions. The front
    // display triangle belongs to x=5, while the innermost ray hits x=1.
    const obj = [1,5].flatMap(x=>[`v ${x} -1 -1`,`v ${x} 2 -1`,`v ${x} -1 2`]).concat(['f 1 2 3','f 4 5 6']).join('\n');
    await writeFile(join(root, 'source.obj'), obj);
    const mesh = parseObjShape(obj,{metersPerUnit:1,expectedVertices:6,expectedFaces:2});
    const lens = {id:'elevation',format:'wavefront-obj',minimum:0,maximum:5,colors:['#000000','#ffffff'],valueTransform:{scale:1,offset:-1},surfaceSampling:{method:'closest-source-point',maximumDistanceMeters:.5}};
    const face = {vertices:[[5,0,0],[5,1,0],[5,0,1]],normal:[1,0,0],vertexNormals:[[1,0,0],[1,0,0],[1,0,0]]};
    // Atlas pixel (0,0) transports to (5,1/4,1/4) m on this retained face.
    const matrix=[BASE_TILE/2,0,0,0,0,0,BASE_TILE/2,0,0,0,1,0,0,5*BASE_TILE,0,1];
    const radial={faces:[face],width:2,height:2,plans:[{face,rect:{x:0,y:0,width:2,height:2},geometry:{leafWidth:2,leafHeight:2},matrix}],scientificSurfaces:new Map([['elevation',createShapeSurfaceSampler(mesh,lens)]])};
    // Deliberately absent: a direct source atlas must not decode its preview.
    const surfaces:RadialMaterialSurface[]=[{id:'elevation',map:{url:'/scenes/test-body/preview.webp'},surfaceSampling:{...lens.surfaceSampling}}];
    await prepareRadialMaterials({radial,surfaces,config:{namespace:'test-body',publicBase:'/scenes/test-body/',geometry:{radiusKm:.001,radius:1,radialTerrain:{}},raster:{width:2,scientific:[lens],surfaceQuality:100}},source:await fixtureSource(root,[{path:'source.obj',consumers:['shape']}]),publicDirectory:root,outputDirectory:root,sunDirection:[1,0,0]});
    const {data}=await sharp(join(root,'test-body-elevation-surface@2x.webp')).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const expected=Math.round((Math.sqrt(25+.25**2+.25**2)-1)/5*255);
    for(const channel of data.subarray(0,3))assert.ok(Math.abs(channel-expected)<=2,`Expected source height color ${expected}, received ${channel}; preview file is deliberately absent`);
    assert.equal(fixtureRecord(surfaces[0],'surfaceSampling','transfer').withheldTexels,0);
  } finally { await rm(root,{recursive:true,force:true}); }
});
