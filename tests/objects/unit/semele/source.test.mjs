import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5799,
  "shapeSha256": "1f263e11028e2a01358e54a68391c8cc9ccd70f4d4e7eae4fbcf09489d26c765",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.424986,
    0.083231,
    0.467153
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000072245893,
  "diameterKm": 117.32,
  "uncertaintyKm": 1.51,
  "lambda": 213.0,
  "beta": -31.0,
  "periodHours": 16.642,
  "name": "Semele",
  "modelVersion": "2019-10-23"
};

test("Semele preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("semele", independentExpected));
