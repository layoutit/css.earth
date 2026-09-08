import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Hekate retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('hekate',['shape','elevation'],43500));
