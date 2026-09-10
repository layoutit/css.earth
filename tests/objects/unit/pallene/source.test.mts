import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {decodeCalibratedCamera,prepareShapeCameraMosaic} from '../../../../tools/objects/terrestrial-layers/shape-camera-mosaic.mts';
const source=new URL('../../../../src/planets/pallene/source/',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,source),'utf8'));

test('Pallene realizes the published ellipsoid dimensions without invented terrain',async()=>{
 const recipe=await json('preparation/terrestrial.json'),p=recipe.geometry.radialTerrain;
 const mesh=await loadPdsRadiusTable(new URL(p.path,source).pathname,p.grid);
 const text=await readFile(new URL('geometry/pck00011.tpc',source),'utf8');
 assert.match(text,/BODY633_RADII\s*=\s*\(\s*2\.88\s+2\.08\s+1\.8\s*\)/);
 for(const [lon,lat,r] of [[0,0,2880],[90,0,2080],[180,0,2880],[270,0,2080],[0,90,1800],[0,-90,1800]])
  assert.ok(Math.abs(mesh.sample(lon,lat)-r)<1e-6,`source axis ${lon},${lat}`);
 const topology=validateClosedMesh(Uint32Array.from(mesh.indices.flat()),mesh.positions);
 assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.components,1);
 assert.equal(topology.faces,5040);
 const analyticVolume=4*Math.PI/3*2880*2080*1800;
 assert.ok(Math.abs(topology.signedVolumeCubicMeters/analyticVolume-1)<.005);
});

test('Pallene reads original I/F and keeps only the qualified source footprint',async()=>{
 const recipe=await json('preparation/terrestrial.json'),manifest=await json('manifest.json');
 const chosen=recipe.raster.mosaics[0];assert.deepEqual(chosen.frames.map(f=>f.id),['n1496910582']);
 const image=decodeCalibratedCamera(await readFile(new URL(chosen.frames[0].path,source)));
 assert.equal(image.offset,8192);assert.equal(image.width,1024);assert.equal(image.height,1024);
 assert.ok(image.data[512*1024+511]>.4&&image.data[512*1024+511]<.55);
 const raw=decodeCalibratedCamera(await readFile(new URL('observations/N1496910582_1.IMG',source)),'vicar-byte-dn');
 let maximum=0;for(let y=500;y<=524;y++)for(let x=499;x<=523;x++)maximum=Math.max(maximum,Math.round(raw.data[y*1024+x]*255));
 assert.equal(maximum,228);
 const map=await prepareShapeCameraMosaic(source.pathname,manifest.inputs.filter(e=>e.consumers.includes(chosen.consumer)),chosen,64,32,recipe.geometry.radialTerrain);
 assert.ok(map.grid.coveragePixels>100&&map.grid.coveragePixels<500);
 // The opposite hemisphere remains a data gap; dark values are not global fill.
 for(let y=0;y<32;y++)for(let x=40;x<64;x++)assert.equal(map.missing[y*64+x],1);
 const rotation=await json('preparation/rotation.json');assert.equal(rotation.schema,'cssearth-display-orientation@1');
 const content=await json('content/object.json');assert.ok(content.settings.controls.some(c=>c.name==='shadows'));
});
