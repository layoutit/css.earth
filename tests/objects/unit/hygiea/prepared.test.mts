import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Hygiea retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('hygiea',['shape','elevation'],216500));
