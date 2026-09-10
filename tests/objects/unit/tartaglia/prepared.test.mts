import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Tartaglia retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("tartaglia", ['shape', 'elevation'], 6792.0));
