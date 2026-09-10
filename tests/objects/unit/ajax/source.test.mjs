import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3327,
  "shapeSha256": "6df93884c639520f83f0b0722c09b7f5796a7edd1cb9a9abcfa5990f626a6cde",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.062709,
    0.239759,
    0.50178
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000570265766,
  "diameterKm": 83.99,
  "uncertaintyKm": 1.279,
  "lambda": 294.0,
  "beta": 42.0,
  "periodHours": 29.3874,
  "name": "Ajax",
  "modelVersion": "2019-05-07"
};

test("Ajax preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ajax", independentExpected));
