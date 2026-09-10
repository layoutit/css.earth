import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Parthenope retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('parthenope',['shape','elevation'],74500));
