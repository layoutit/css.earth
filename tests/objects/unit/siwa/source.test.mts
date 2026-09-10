import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5987,
  "shapeSha256": "a6cf15b20cd4bcfb839a14044d91774e83056e3457b568b0c3659da8d0607b67",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.032158,
    -0.045727,
    0.531076
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999951293131,
  "diameterKm": 110.61,
  "uncertaintyKm": 1.67,
  "lambda": 88.0,
  "beta": -27.0,
  "periodHours": 34.398,
  "name": "Siwa",
  "modelVersion": "2022-02-14"
};

test("Siwa preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("siwa", independentExpected));
