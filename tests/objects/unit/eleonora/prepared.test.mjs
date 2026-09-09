import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Eleonora retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('eleonora',['shape','elevation'],82500));
