import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('1992 SK retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('asteroid-1992-sk',['shape','elevation'],500));
