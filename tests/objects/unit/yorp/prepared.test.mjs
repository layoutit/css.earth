import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('YORP retains Shape, Elevation and native raster triangles',async()=>{
 await assertAsteroidPackage('yorp',['shape','elevation'],56.4);
 const surfaces=JSON.parse(await readFile(new URL('../../../../src/planets/yorp/prepared/surfaces.json',import.meta.url)));
 const science=surfaces.surfaces.find(surface=>surface.id==='elevation');
 assert.equal(science.surfaceSampling.method,'closest-source-point');
 assert.equal(science.surfaceSampling.transfer.withheldTriangleInteriorTexels,0,'Every retained triangle interior receives its source-surface scalar');
 assert.ok(science.surfaceSampling.transfer.maximumDistanceMeters<=science.surfaceSampling.maximumDistanceMeters);
});
