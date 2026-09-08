import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Aurora retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('aurora',['shape','elevation'],99000));
