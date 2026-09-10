import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1185,
  "shapeSha256": "b576ef6ed10c1950eb578412561c1829d8d537c14ad28ac7ff30cb5ceb14135a",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.329663,
    0.175362,
    0.551068
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999175479006,
  "diameterKm": 139.65,
  "uncertaintyKm": 2.09,
  "lambda": 359.0,
  "beta": 25.0,
  "periodHours": 8.13456,
  "name": "Nuwa",
  "modelVersion": "2016-01-04"
};

test("Nuwa preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("nuwa", independentExpected));
