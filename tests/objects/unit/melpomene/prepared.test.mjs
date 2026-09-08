import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Melpomene retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('melpomene',['shape','elevation'],70500));
