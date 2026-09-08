import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Kressmannia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("kressmannia", ['shape', 'elevation'], 7714.5));
