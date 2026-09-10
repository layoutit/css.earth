import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Rosalinde retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("rosalinde", ['shape', 'elevation'], 9809.0));
