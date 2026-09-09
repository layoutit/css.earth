import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 720,
  "shapeSha256": "109763528dc5541c8d5ee603522994a0c754eb2f8220a8b3fcef950ccd5f9f4c",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    0.043012,
    0.003447,
    0.600991
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000045317876,
  "diameterKm": 114.22,
  "uncertaintyKm": 1.52,
  "lambda": 161.0,
  "beta": -15.0,
  "periodHours": 12.83612,
  "name": "38 Leda",
  "modelVersion": "2013-10-16"
};

test("38 Leda preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("leda-38", independentExpected));
