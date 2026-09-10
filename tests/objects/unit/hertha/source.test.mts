import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1799,
  "shapeSha256": "78a7b01400fb50944ee01a4cfcd1a7c3b4b12ecbc7b83861081a49aebb565a6c",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    5.049976,
    -13.84536,
    19.225508
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 259354.97595498673,
  "diameterKm": 79.0,
  "uncertaintyKm": 2.0,
  "lambda": 276.0,
  "beta": 53.0,
  "periodHours": 8.4006,
  "name": "Hertha",
  "modelVersion": "2017-06-14"
};

test("Hertha preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hertha", independentExpected));
