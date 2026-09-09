import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 442,
  "shapeSha256": "3762ea95ed2846b90e9df6c81300e467a7419b09236b6de8d9bf60209eeea848",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.01469,
    -0.063002,
    0.523918
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998914105835,
  "diameterKm": 168.36,
  "uncertaintyKm": 1.95,
  "lambda": 140.0,
  "beta": 14.0,
  "periodHours": 9.97306,
  "name": "Freia",
  "modelVersion": "2012-07-30"
};

test("Freia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("freia", independentExpected));
