import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Veritas retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("veritas", ['shape', 'elevation'], 59401.5));
