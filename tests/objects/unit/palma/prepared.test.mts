import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Palma retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('palma',['shape','elevation'],93500));
