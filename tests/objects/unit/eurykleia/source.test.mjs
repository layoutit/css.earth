import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3102,
  "shapeSha256": "f357504dd44ea1e679c796b0878da27943b23109fd4c576ae8e8673abaee1eb9",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.775896,
    -3.588127,
    43.168289
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 344791.40013818286,
  "diameterKm": 87.0,
  "uncertaintyKm": 11.0,
  "lambda": 101.0,
  "beta": 71.0,
  "periodHours": 16.52178,
  "name": "Eurykleia",
  "modelVersion": "2019-06-24"
};

test("Eurykleia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eurykleia", independentExpected));
