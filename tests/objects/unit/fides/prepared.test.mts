import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Fides retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('fides',['shape','elevation'],59000));
