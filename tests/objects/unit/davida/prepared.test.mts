import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Davida retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('davida',['shape','elevation'],149000));
