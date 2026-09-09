import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3097,
  "shapeSha256": "7c4aa5b44d5ef71a8caa8719f647e29ac0d4dc23d64f50ca30c682718df9a9e0",
  "vertices": 988,
  "faces": 1972,
  "firstVertex": [
    -11.224484,
    -5.81428,
    43.18301
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 321555.12813677243,
  "diameterKm": 85.0,
  "uncertaintyKm": 6.0,
  "lambda": 77.0,
  "beta": -26.0,
  "periodHours": 13.19055,
  "name": "Felicitas",
  "modelVersion": "2019-06-24"
};

test("Felicitas preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("felicitas", independentExpected));
