import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Lutetia retains its photographic and source-shape views, native raster triangles and physical context',()=>assertAsteroidPackage('lutetia',['osiris','shape','elevation'],49000));
