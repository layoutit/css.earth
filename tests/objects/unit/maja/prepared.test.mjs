import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Maja retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("maja", ['shape', 'elevation'], 35895.0));
