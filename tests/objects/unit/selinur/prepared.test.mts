import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("Selinur retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("selinur", ['shape', 'elevation'], 20414.0));
