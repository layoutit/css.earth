import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';
test('Kleopatra retains the published Shape view, native raster triangles and physical context',()=>assertAsteroidPackage('kleopatra',['shape'],59100));
