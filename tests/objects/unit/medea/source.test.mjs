import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1091,
  "shapeSha256": "7002b307b1713a7ab911659586b73aac5175f32f77a06eadb506f9d2d3c8294f",
  "vertices": 1007,
  "faces": 2010,
  "firstVertex": [
    -0.052361,
    -0.00215,
    0.636403
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999780911848,
  "diameterKm": 153.72,
  "uncertaintyKm": 2.88,
  "lambda": 40.0,
  "beta": -24.0,
  "periodHours": 10.28414,
  "name": "Medea",
  "modelVersion": "2016-01-04"
};

test("Medea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("medea", independentExpected));
