import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mjs';

test("Gryphia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("gryphia", ['shape', 'elevation'], 7201.5));
