import {test} from 'node:test';
import {assertAsteroidPackage} from '../asteroid-contract.mts';

test("2001 QW16 retains Shape, Elevation and native raster triangles", () => assertAsteroidPackage("asteroid-2001-qw16", ['shape', 'elevation'], 5201.5));
