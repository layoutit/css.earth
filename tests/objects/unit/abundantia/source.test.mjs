import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4625,
  "shapeSha256": "30c56d5b9f294437dfb49eec0cc71c4ff68980845df2ef72f0ccfed1bac61478",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.305783,
    0.018524,
    0.574423
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000047121335,
  "diameterKm": 42.18,
  "uncertaintyKm": 0.49,
  "lambda": 188.0,
  "beta": 32.0,
  "periodHours": 9.8643,
  "name": "Abundantia",
  "modelVersion": "2019-10-23"
};

test("Abundantia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("abundantia", independentExpected));
