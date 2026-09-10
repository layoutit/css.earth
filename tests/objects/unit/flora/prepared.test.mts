import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Flora retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('flora',['shape','elevation'],73000));
