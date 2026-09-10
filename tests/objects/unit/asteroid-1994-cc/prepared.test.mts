import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('1994 CC Alpha retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('asteroid-1994-cc',['shape','elevation'],310));
