import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3233,
  "shapeSha256": "5d85d9ffc8185618d1fb1a32c0b452dc7d5f1efcfc0008f25dd00f2a54d738e5",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.041106,
    0.030911,
    0.753909
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999881701129,
  "diameterKm": 147.05,
  "uncertaintyKm": 3.58,
  "lambda": 150.0,
  "beta": 17.0,
  "periodHours": 13.1771,
  "name": "Aglaja",
  "modelVersion": "2019-05-07"
};

test("Aglaja preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("aglaja", independentExpected));
