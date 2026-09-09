import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4072,
  "shapeSha256": "74994217a690be9e8736a7709f52c8e70c80a0f63c0d7160f73e7cd9924ec078",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.007608,
    -0.201829,
    0.588915
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999908384961,
  "diameterKm": 100.93,
  "uncertaintyKm": 1.4,
  "lambda": 170.0,
  "beta": -39.0,
  "periodHours": 17.60386,
  "name": "Kolga",
  "modelVersion": "2019-05-07"
};

test("Kolga preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("kolga", independentExpected));
