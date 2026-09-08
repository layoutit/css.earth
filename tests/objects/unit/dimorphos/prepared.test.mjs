import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Dimorphos retains both source-shape views, native raster triangles and physical context',()=>assertAsteroidPackage('dimorphos',['shape','elevation'],75));
