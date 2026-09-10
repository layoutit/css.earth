import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 845,
  "shapeSha256": "e0158056d0fcd78655afea95b3e0bff52c8430f45bd2c6c6b5efc1fdff30d188",
  "vertices": 1014,
  "faces": 2024,
  "firstVertex": [
    0.061572,
    -0.091701,
    0.636273
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998997490126,
  "diameterKm": 12.17,
  "uncertaintyKm": 0.23,
  "lambda": 25.0,
  "beta": -53.0,
  "periodHours": 5.895048,
  "name": "Augusta",
  "modelVersion": "2016-01-04"
};

test("Augusta preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("augusta", independentExpected));
