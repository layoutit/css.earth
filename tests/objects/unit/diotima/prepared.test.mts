import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Diotima retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('diotima',['shape','elevation'],104500));
