import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Achilles retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("achilles", ['shape', 'elevation'], 65500.0));
