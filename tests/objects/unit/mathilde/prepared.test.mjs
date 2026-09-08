import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Mathilde retains its published shape, both lenses, native raster triangles and physical context',
  () => assertAsteroidPackage('mathilde',['normal','elevation'],26400));
