import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Schaber retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("schaber", ['shape', 'elevation'], 13269.0));
