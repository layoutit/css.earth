import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("IAU retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("iau", ['shape', 'elevation'], 2121.0));
