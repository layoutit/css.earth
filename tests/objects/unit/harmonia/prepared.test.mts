import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Harmonia retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('harmonia',['shape','elevation'],55500));
