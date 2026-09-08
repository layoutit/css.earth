import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Toutatis retains its source shape, native raster triangles and physical context',()=>assertAsteroidPackage('toutatis',['shape'],1224));
