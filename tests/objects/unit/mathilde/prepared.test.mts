import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Mathilde retains its published shape models, three lenses, native raster triangles and physical context',
  () => assertAsteroidPackage('mathilde',['normal','near-msi','elevation'],26400));
