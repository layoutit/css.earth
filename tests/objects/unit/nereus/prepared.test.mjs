import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Nereus retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('nereus',['shape','elevation'],165));
