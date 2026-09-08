import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('2002 CE26 Primary retains Shape, Elevation and native raster triangles',async()=>{
 await assertAsteroidPackage('asteroid-2002-ce26',['shape','elevation'],1730);
 const surfaces=JSON.parse(await readFile(new URL('../../../../src/planets/asteroid-2002-ce26/prepared/surfaces.json',import.meta.url)));
 const science=surfaces.surfaces.find(surface=>surface.id==='elevation');
 assert.equal(science.surfaceSampling.method,'closest-source-point');
 assert.equal(science.surfaceSampling.transfer.withheldTriangleInteriorTexels,0,'Every retained triangle interior receives its source-surface scalar');
 assert.ok(science.surfaceSampling.transfer.maximumDistanceMeters<=science.surfaceSampling.maximumDistanceMeters);
});
