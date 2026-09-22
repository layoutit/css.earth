import {requireString,requireRecord} from '../../../tools/sources/source-values.mts';
import {required} from '../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseObjShape,createIndexedShape} from '../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {simplifyRadialShape,validateClosedMesh} from '../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';

// Independent coordinates in the native PDS tables, before metre conversion.
const expected={
 alpha:{extent:[2753.814,2719.734,2856.704],diameter:[2.2,2.8],role:'primary'},
 beta:{extent:[765.735,1037.912,656.261],diameter:[.65,.89],role:'larger, outer satellite'},
 gamma:{extent:[554.912,430.533,421.852],diameter:[.29,.57],role:'smaller, inner satellite'},
};
export function checkSn263Shape(id: string,component: keyof typeof expected){
 const root=new URL(`../../../src/objects/${id}/source/`,import.meta.url);
 const read=async (path: string|URL)=>JSON.parse((await readFile(new URL(path,root))).toString('utf8'));
 test(`${id}: PDS component, units, input closure and shape agree`,async()=>{
  const source=await createSourceManifest({planetId:id,planetName:id,sourceRoot:root.pathname});await source.verify();
  const config=await read('preparation/terrestrial.json'),profile=config.geometry.radialTerrain;
  const bytes=await readFile(new URL(profile.path,root));
  const entry=required(source.manifest.inputs.find(x=>x.id==='radar-shape'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.expectedSha256);
  const label=await readFile(new URL(`reference/a153591${component}.xml`,root),'utf8');
  assert.ok(label.includes(expected[component].role));assert.match(label,/units are kilometers/);
  assert.ok(label.includes(requireString(requireRecord(entry).product).split('::')[0]),'native product identity, not a fabricated LID');
  const mesh=parseObjShape(bytes.toString(),profile.grid);
  const topology=validateClosedMesh(Uint32Array.from(mesh.indices.flat()),mesh.positions);
  assert.equal(topology.components,1);assert.equal(topology.eulerCharacteristic,2);
  for(let axis=0;axis<3;axis++){
   const values=mesh.positions.map(v=>v[axis]);assert.ok(Math.abs(Math.max(...values)-Math.min(...values)-expected[component].extent[axis])<1e-6);
  }
  const diameter=config.geometry.radiusKm*2;assert.ok(diameter>=expected[component].diameter[0]&&diameter<=expected[component].diameter[1]);
  const rotation=await read('preparation/rotation.json');
  assert.equal(rotation.schema,component==='alpha'?'cssearth-observed-pole@1':'cssearth-display-orientation@1');
  assert.equal(rotation.phase,'arbitrary-display-phase');
 });
 test(`${id}: prepared mesh preserves closed shape and bounded source fit`,async()=>{
  const config=await read('preparation/terrestrial.json'),profile=config.geometry.radialTerrain;
  const mesh=parseObjShape(await readFile(new URL(profile.path,root),'utf8'),profile.grid);
  const faces=await simplifyRadialShape(mesh,profile,1);
  assert.ok(faces.length<=800);assert.equal(requireRecord(required(faces.simplification).topology).components,1);
  const vertices=faces.flatMap(f=>f.vertices.map(v=>[...v])),indices=faces.map((_,i)=>[i*3,i*3+1,i*3+2]);
  const reduced=createIndexedShape(vertices,indices,{metersPerUnit:1,expectedVertices:vertices.length,expectedFaces:faces.length});
  let maximum=0;
  for(let lat=-85;lat<=85;lat+=10)for(let lon=0;lon<360;lon+=10){
   const before=required(mesh.sample(lon,lat)),after=required(reduced.sample(lon,lat));
   assert.ok(Number.isFinite(before)&&Number.isFinite(after));maximum=Math.max(maximum,Math.abs(before-after));
  }
  assert.ok(maximum<=profile.simplification.maximumErrorMeters,`sampled radial deviation ${maximum}m exceeds ${profile.simplification.maximumErrorMeters}m`);
 });
}
