import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Moshup retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('moshup',['shape','elevation'],658.5));
