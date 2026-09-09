import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('gaspra preserves its shape, supported views and native raster triangles',()=>assertAsteroidPackage('gaspra',['normal','elevation'],6100));
