import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Hopi retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("hopi", ['shape', 'elevation'], 9633.5));
