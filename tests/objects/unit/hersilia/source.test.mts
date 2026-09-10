import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3217,
  "shapeSha256": "8e2c5f76b6378e942e105825b60568612becb8902a67d2c7c4dfc34d92b31b2f",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.024505,
    0.059226,
    0.61116
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000803716926,
  "diameterKm": 93.93,
  "uncertaintyKm": 0.94,
  "lambda": 250.0,
  "beta": 43.0,
  "periodHours": 11.11129,
  "name": "Hersilia",
  "modelVersion": "2019-05-07"
};

test("Hersilia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hersilia", independentExpected));
