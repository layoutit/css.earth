import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Virtanen retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("virtanen", ['shape', 'elevation'], 4631.5));
