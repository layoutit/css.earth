import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Toutatis exposes source-surface elevation on its retained shape and native raster triangles',()=>assertAsteroidPackage('toutatis',['shape','elevation'],1224));
