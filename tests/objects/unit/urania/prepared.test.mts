import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Urania retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('urania',['shape','elevation'],44000));
