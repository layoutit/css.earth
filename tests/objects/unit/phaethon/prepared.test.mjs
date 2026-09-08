import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Phaethon retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('phaethon',['shape','elevation'],2550));
