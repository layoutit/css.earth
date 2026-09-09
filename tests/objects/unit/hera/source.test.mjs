import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 917,
  "shapeSha256": "155404c32e4202324ad5e4aaa574252ac2688e6f9f2b1c3fbc56ddc6514afa36",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.036945,
    0.066452,
    0.625979
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000002175644298,
  "diameterKm": 83.23,
  "uncertaintyKm": 1.04,
  "lambda": 85.0,
  "beta": 24.0,
  "periodHours": 23.74265,
  "name": "Hera",
  "modelVersion": "2016-01-04"
};

test("Hera preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hera", independentExpected));
