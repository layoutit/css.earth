import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Tulipa retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("tulipa", ['shape', 'elevation'], 13937.5));
