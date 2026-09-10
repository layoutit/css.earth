import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 864,
  "shapeSha256": "39f5363411a234415535e0ece44d5783636a4655bfd0bf0bcc8e1d00493414fc",
  "vertices": 996,
  "faces": 1988,
  "firstVertex": [
    -0.073999,
    -0.016431,
    0.467439
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000061697116,
  "diameterKm": 37.03,
  "uncertaintyKm": 0.61,
  "lambda": 2.0,
  "beta": 85.0,
  "periodHours": 84.995,
  "name": "Ilse",
  "modelVersion": "2016-01-04"
};

test("Ilse preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ilse", independentExpected));
