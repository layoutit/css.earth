import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Virginia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("virginia", ['shape', 'elevation'], 42185.0));
