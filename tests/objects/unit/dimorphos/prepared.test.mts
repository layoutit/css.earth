import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Dimorphos retains source-shape, DRACO photograph, relative-albedo and gravity-slope views, native raster triangles and physical context',()=>assertAsteroidPackage('dimorphos',['shape','draco','elevation','albedo','slope'],75));
