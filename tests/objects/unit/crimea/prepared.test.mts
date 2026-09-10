import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Crimea retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("crimea", ['shape', 'elevation'], 14589.5));
