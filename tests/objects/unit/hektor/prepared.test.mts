import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Hektor retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('hektor',['shape','elevation'],87500));
