import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Toutatis retains its source shape, photo projection, native raster triangles and physical context',()=>assertAsteroidPackage('toutatis',['shape','chang-e-2'],1224));
