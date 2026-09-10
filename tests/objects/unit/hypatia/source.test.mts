import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3844,
  "shapeSha256": "61b02e21efc8fa19b782a3c1828b46bd1d1bfdf2c35ad352fd995ec9b0aae399",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.287027,
    0.316123,
    0.491075
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999997037327296,
  "diameterKm": 143.97,
  "uncertaintyKm": 1.55,
  "lambda": 261.0,
  "beta": 45.0,
  "periodHours": 8.87273,
  "name": "Hypatia",
  "modelVersion": "2019-05-07"
};

test("Hypatia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hypatia", independentExpected));
