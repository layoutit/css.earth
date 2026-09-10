import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Melpomene retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('melpomene',['shape','elevation'],70500));
