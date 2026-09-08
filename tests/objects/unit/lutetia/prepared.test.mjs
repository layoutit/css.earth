import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Lutetia retains both source-shape views, native raster triangles and physical context',()=>assertAsteroidPackage('lutetia',['shape','elevation'],49000));
