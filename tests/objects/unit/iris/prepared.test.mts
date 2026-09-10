import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Iris retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('iris',['shape','elevation'],99500));
