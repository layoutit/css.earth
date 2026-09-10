import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5831,
  "shapeSha256": "8f40507e4c1c4fcf4858c89d9490e22ed2cbbea81363305f993f8f5a9cf7a5de",
  "vertices": 570,
  "faces": 1136,
  "firstVertex": [
    0.261335,
    0.330729,
    0.546019
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998666300286,
  "diameterKm": 100.17,
  "uncertaintyKm": 1.23,
  "lambda": 40.0,
  "beta": 32.0,
  "periodHours": 6.02819,
  "name": "Aegina",
  "modelVersion": "2019-10-23"
};

test("Aegina preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("aegina", independentExpected));
