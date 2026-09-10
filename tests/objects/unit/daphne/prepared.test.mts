import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Daphne retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('daphne',['shape','elevation'],93500));
