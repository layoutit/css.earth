import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Mr. Spock retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("mr-spock", ['shape', 'elevation'], 9853.5));
