import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Kalliope retains Shape, Elevation, native raster triangles and physical context',()=>assertAsteroidPackage('kalliope',['shape','elevation'],75000));
