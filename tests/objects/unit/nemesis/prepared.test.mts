import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Nemesis retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('nemesis',['shape','elevation'],81500));
