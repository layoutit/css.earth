import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Lucia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("lucia", ['shape', 'elevation'], 26410.0));
