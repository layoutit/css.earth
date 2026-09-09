import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Juewa retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("juewa", ['shape', 'elevation'], 83345.0));
