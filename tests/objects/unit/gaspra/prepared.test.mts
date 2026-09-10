import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('gaspra preserves its shape, supported views and native raster triangles',()=>assertAsteroidPackage('gaspra',['normal','calibrated','elevation'],6100));
