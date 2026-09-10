import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Eugenia retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('eugenia',['shape','elevation'],94000));
