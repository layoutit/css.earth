import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Thule retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('thule',['shape','elevation'],58000));
