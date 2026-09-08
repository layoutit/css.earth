import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Penelope retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('penelope',['shape','elevation'],42500));
