import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Parysatis retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("parysatis", ['shape', 'elevation'], 22374.5));
