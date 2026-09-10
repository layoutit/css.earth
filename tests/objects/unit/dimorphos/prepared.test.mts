import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Dimorphos retains source-shape, relative-albedo and gravity-slope views, native raster triangles and physical context',()=>assertAsteroidPackage('dimorphos',['shape','elevation','albedo','slope'],75));
