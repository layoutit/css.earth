import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('1998 WT24 retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('asteroid-1998-wt24',['shape','elevation'],207.5));
