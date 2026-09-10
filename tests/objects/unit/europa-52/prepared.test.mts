import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('52 Europa retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('europa-52',['shape','elevation'],159500));
