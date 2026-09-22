import {required} from '../../../../tools/contract/test-values.mts';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('setebos');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=new URL('../../../../src/objects/setebos/source/',import.meta.url);
test('Setebos radius table preserves independently derived physical-axis anchors',async()=>{
 const config=JSON.parse(await readFile(new URL('preparation/terrestrial.json',root),'utf8'));
 const shape=parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab',root),'utf8'),config.geometry.radialTerrain.grid);
 for(const [lon,lat,metres] of [[0, 0, 27737.53493781565], [90, 0, 21630.564936199527], [0, 90, 21630.564936199527], [0, -90, 21630.564936199527]] as const) assert.ok(Math.abs(required(shape.sample(lon,lat))-metres)<.001,`${lon},${lat}`);
 const topology=validateClosedMesh(Uint32Array.from(shape.indices.flat()),shape.positions);
 assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.components,1);
});
