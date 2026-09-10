import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Ducrosa retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("ducrosa", ['shape', 'elevation'], 17050.0));
