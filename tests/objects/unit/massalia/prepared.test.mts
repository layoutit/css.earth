import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Massalia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("massalia", ['shape', 'elevation'], 73500.0));
