import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Camilla retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('camilla',['shape','elevation'],130000));
