import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 16306,
  "shapeSha256": "348c1281cc6d9a359f9dfa7efa783ca0500239edfa49473380627394b9fcfb4e",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    19.38957,
    -7.700915,
    42.573761
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 369120.9110942592,
  "diameterKm": 89.0,
  "uncertaintyKm": 7.0,
  "lambda": 102.0,
  "beta": 47.0,
  "periodHours": 9.447662,
  "name": "Pomona",
  "modelVersion": "2024-10-11"
};

test("Pomona preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("pomona", independentExpected));
