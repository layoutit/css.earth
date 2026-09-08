import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Nysa retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('nysa',['shape','elevation'],37500));
