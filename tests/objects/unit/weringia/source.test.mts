import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1074,
  "shapeSha256": "b5ea3c7a8dacc9eb8d62f5ea85376eeeec1d1d521461ea669a201a5f7d97646b",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.36171,
    0.030309,
    0.533042
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001234059464,
  "diameterKm": 32.26,
  "uncertaintyKm": 0.36,
  "lambda": 284.0,
  "beta": -14.0,
  "periodHours": 11.14849,
  "name": "Weringia",
  "modelVersion": "2016-01-04"
};

test("Weringia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("weringia", independentExpected));
