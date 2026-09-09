import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("United Nations retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("united-nations", ['shape', 'elevation'], 5500.0));
