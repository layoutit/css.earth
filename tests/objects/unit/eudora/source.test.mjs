import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3998,
  "shapeSha256": "0f268a3c1e9d6d8999666bcfc41159f50c0fd0f023a7df1765a672442da2b183",
  "vertices": 564,
  "faces": 1124,
  "firstVertex": [
    0.01104,
    0.462817,
    0.447869
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999698225791,
  "diameterKm": 67.8,
  "uncertaintyKm": 1.18,
  "lambda": 135.0,
  "beta": -25.0,
  "periodHours": 25.2626,
  "name": "Eudora",
  "modelVersion": "2019-05-07"
};

test("Eudora preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eudora", independentExpected));
