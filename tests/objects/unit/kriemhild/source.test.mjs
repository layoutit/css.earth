import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 621,
  "shapeSha256": "d1556ed22d1a7df79537f2d50d2cc6389142aa9eccda3e14f362efb2375bcb17",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.122216,
    0.113006,
    0.47177
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000210565527,
  "diameterKm": 45.14,
  "uncertaintyKm": 0.51,
  "lambda": 284.0,
  "beta": -15.0,
  "periodHours": 4.545177,
  "name": "Kriemhild",
  "modelVersion": "2013-02-11"
};

test("Kriemhild preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("kriemhild", independentExpected));
