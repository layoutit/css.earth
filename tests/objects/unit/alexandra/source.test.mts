import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1817,
  "shapeSha256": "aac6326c6087972265e999ec6778be6f932abf27a7643fc745dc055b3b79c643",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -6.967972,
    12.969707,
    63.507757
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1535802.1750024606,
  "diameterKm": 143.0,
  "uncertaintyKm": 5.0,
  "lambda": 154.0,
  "beta": 17.0,
  "periodHours": 7.02264,
  "name": "Alexandra",
  "modelVersion": "2017-06-07"
};

test("Alexandra preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("alexandra", independentExpected));
