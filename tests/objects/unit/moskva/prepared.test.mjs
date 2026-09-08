import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Moskva retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("moskva", ['shape', 'elevation'], 15981.0));
