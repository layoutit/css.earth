import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Diotima retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('diotima',['shape','elevation'],104500));
