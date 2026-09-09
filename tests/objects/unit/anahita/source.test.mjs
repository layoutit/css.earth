import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1183,
  "shapeSha256": "8d486e3f083430418ce79d7578da3ebb901e03d365b1d37324e3b437c6f25065",
  "vertices": 1014,
  "faces": 2024,
  "firstVertex": [
    0.109297,
    0.055098,
    0.543432
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000002903595095,
  "diameterKm": 46.93,
  "uncertaintyKm": 0.69,
  "lambda": 15.0,
  "beta": -50.0,
  "periodHours": 15.05906,
  "name": "Anahita",
  "modelVersion": "2016-01-04"
};

test("Anahita preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("anahita", independentExpected));
