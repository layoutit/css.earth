import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1809,
  "shapeSha256": "0da05739bf0a1b246d7930dbcc5e8d8a7198a16b02fb97ea8ff9d3f38703c9d6",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -0.839559,
    0.645044,
    92.826037
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 2901776.996502301,
  "diameterKm": 177.0,
  "uncertaintyKm": 5.0,
  "lambda": 180.0,
  "beta": 31.0,
  "periodHours": 7.22439,
  "name": "Loreley",
  "modelVersion": "2017-06-16"
};

test("Loreley preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("loreley", independentExpected));
