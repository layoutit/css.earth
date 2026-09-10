import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('steins preserves its shape, supported views and native raster triangles',()=>assertAsteroidPackage('steins',['osiris','normal','elevation'],2580));
