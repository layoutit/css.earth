import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Musa retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("musa", ['shape', 'elevation'], 12557.5));
