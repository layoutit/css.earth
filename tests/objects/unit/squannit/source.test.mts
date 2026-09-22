import { sourceTest } from '../../source-test.mts';
const test = sourceTest('squannit');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseObjShape} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import {validateClosedMesh} from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
const root=new URL('../../../../src/objects/squannit/source/',import.meta.url);
test('Squannit retains original JPL Beta mesh scale and topology',async()=>{
 const bytes=await readFile(new URL('shape/kw4b.obj',root));assert.equal(createHash('sha256').update(bytes).digest('hex'),'3d65690a33c5bb2ef1a7b2f40c0a6faf26f40bd87b0f6bc27a7f801d4ec50256');
 const shape=parseObjShape(bytes.toString(),{metersPerUnit:1000,expectedVertices:1148,expectedFaces:2292});
 const topology=validateClosedMesh(Uint32Array.from(shape.indices.flat()),shape.positions);assert.equal(topology.eulerCharacteristic,2);assert.equal(topology.components,1);
 for(const [axis,extent] of [[0,571.130],[1,463.039],[2,348.909]] as const) {const values=shape.positions.map(vertex=>vertex[axis]);assert.ok(Math.abs(Math.max(...values)-Math.min(...values)-extent)<.001);}
});
