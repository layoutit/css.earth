import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('steins preserves its shape, supported views and native raster triangles',()=>assertAsteroidPackage('steins',['normal','elevation'],2580));
