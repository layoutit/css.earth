import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Elektra retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('elektra',['shape','elevation'],99500));
