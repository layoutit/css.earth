import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Dimorphos retains source-shape and gravity-slope views, native raster triangles and physical context',()=>assertAsteroidPackage('dimorphos',['shape','elevation','slope'],75));
