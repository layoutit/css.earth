import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('1950 DA retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('asteroid-1950-da',['shape','elevation'],650));
