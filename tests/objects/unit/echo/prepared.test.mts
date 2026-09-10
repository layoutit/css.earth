import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Echo retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("echo", ['shape', 'elevation'], 29475.0));
