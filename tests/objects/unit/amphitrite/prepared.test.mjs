import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Amphitrite retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('amphitrite',['shape','elevation'],102000));
