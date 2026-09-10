import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Herculina retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('herculina',['shape','elevation'],94500));
