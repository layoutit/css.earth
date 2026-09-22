import { sourceTest } from '../../source-test.mts';
const test = sourceTest('asteroid-1998-ml14');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requireArray, requireFiniteNumber, requireRecord} from '../../../../tools/sources/source-values.mts';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('1998 ML14 retains Shape, Elevation and native raster triangles',async()=>{
 await assertAsteroidPackage('asteroid-1998-ml14',['shape','elevation'],500);
 const surfaces=requireRecord(JSON.parse(await readFile(new URL('../../../../src/objects/asteroid-1998-ml14/prepared/surfaces.json',import.meta.url),'utf8')),'prepared surfaces');
 const science=requireArray(surfaces.surfaces,'prepared surfaces').map((surface,index)=>requireRecord(surface,`prepared surface ${index}`)).find(surface=>surface.id==='elevation');
 assert.ok(science,'Elevation surface is prepared');
 const sampling=requireRecord(science.surfaceSampling,'elevation sampling'),transfer=requireRecord(sampling.transfer,'elevation transfer');
 assert.equal(sampling.method,'closest-source-point');
 assert.equal(transfer.withheldTriangleInteriorTexels,0,'Every retained triangle interior receives its source-surface scalar');
 assert.ok(requireFiniteNumber(transfer.maximumDistanceMeters,'maximum source distance')<=requireFiniteNumber(sampling.maximumDistanceMeters,'maximum configured distance'));
});
