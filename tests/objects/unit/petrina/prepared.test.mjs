import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Petrina retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("petrina", ['shape', 'elevation'], 22100.0));
