import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';
test('Mithra retains Shape, Elevation and native raster triangles',()=>assertAsteroidPackage('mithra',['shape','elevation'],845));
