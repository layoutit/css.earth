import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Pallas retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('pallas',['shape','elevation'],255500));
