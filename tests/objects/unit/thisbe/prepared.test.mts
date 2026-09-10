import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Thisbe retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('thisbe',['shape','elevation'],109000));
