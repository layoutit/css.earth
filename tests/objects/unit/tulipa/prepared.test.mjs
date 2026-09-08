import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Tulipa retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("tulipa", ['shape', 'elevation'], 13937.5));
